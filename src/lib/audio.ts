/**
 * Web Audio engine for SBAS Lab: the alert chime, keyed tones and radio noise
 * under a captioned radio call. All sounds are synthesised; nothing is
 * recorded. Every sound posts a caption so it is never the only cue.
 */

import { create } from 'zustand'
import { usePrefs } from '@/stores/prefs'

/** One tone-on period of a keyed sound, s from the start of the pattern. */
export interface ToneSegment {
  startS: number
  durationS: number
}

// ---------------------------------------------------------------------------
// Captions
// ---------------------------------------------------------------------------

interface CaptionState {
  text: string | null
  id: number
  show: (text: string, seconds?: number) => void
  clear: () => void
}

let captionTimer: number | undefined

export const useCaptions = create<CaptionState>()((set, get) => ({
  text: null,
  id: 0,
  show: (text, seconds = 4) => {
    window.clearTimeout(captionTimer)
    const id = get().id + 1
    set({ text, id })
    captionTimer = window.setTimeout(() => {
      if (get().id === id) set({ text: null })
    }, seconds * 1000)
  },
  clear: () => set({ text: null }),
}))

export const caption = (text: string, seconds?: number) => useCaptions.getState().show(text, seconds)

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export interface SoundHandle {
  stop: () => void
  setGain?: (g: number) => void
}

const RAMP = 0.004 // s, to avoid clicks

class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private handles = new Set<SoundHandle>()
  /** The browser refused to create an audio context: stay silent for this session. */
  private unavailable = false

  get enabled() {
    return usePrefs.getState().soundOn
  }

  /** Create (or resume) the audio context. Must be called from a user gesture the first time. */
  ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor || this.unavailable) return null
    if (!this.ctx) {
      try {
        this.ctx = new Ctor()
        this.master = this.ctx.createGain()
        this.master.gain.value = 0.8
        this.master.connect(this.ctx.destination)
      } catch {
        // Blocked or unsupported (too many contexts, sandboxed frame): stay silent, captions still show.
        this.ctx = null
        this.master = null
        this.unavailable = true
        return null
      }
    }
    // 'interrupted' is Safari's state after a phone call or another app took the audio.
    if (this.ctx.state === 'suspended' || (this.ctx.state as string) === 'interrupted') this.ctx.resume().catch(() => {})
    return this.ctx
  }

  private track(h: SoundHandle): SoundHandle {
    this.handles.add(h)
    const stop = h.stop
    h.stop = () => {
      this.handles.delete(h)
      stop()
    }
    return h
  }

  /** Stop every sound (used on reset or when muting). */
  stopAll() {
    // A copy: each stop() removes its handle from the set.
    // oxlint-disable-next-line unicorn/no-useless-spread
    for (const h of [...this.handles]) h.stop()
  }

  /** A single tone. */
  tone(freqHz: number, durationS: number, opts: { gain?: number; type?: OscillatorType; delayS?: number } = {}): SoundHandle {
    const ctx = this.enabled ? this.ensure() : null
    if (!ctx || !this.master) return { stop: () => {} }
    const t0 = ctx.currentTime + (opts.delayS ?? 0) + 0.01
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = opts.type ?? 'sine'
    osc.frequency.value = freqHz
    g.gain.setValueAtTime(0, t0)
    g.gain.linearRampToValueAtTime(opts.gain ?? 0.15, t0 + RAMP)
    g.gain.setValueAtTime(opts.gain ?? 0.15, t0 + durationS - RAMP)
    g.gain.linearRampToValueAtTime(0, t0 + durationS)
    osc.connect(g).connect(this.master)
    osc.start(t0)
    osc.stop(t0 + durationS + 0.05)
    const h = this.track({
      stop: () => {
        try {
          osc.stop()
        } catch {
          /* already stopped */
        }
      },
    })
    osc.onended = () => h.stop()
    return h
  }

  /**
   * A keyed tone (Morse, marker beacons). Segments are tone-on periods.
   * With `loopPeriodS` the pattern repeats until stopped.
   */
  keyed(
    segments: ToneSegment[],
    freqHz: number,
    opts: { gain?: number; loopPeriodS?: number; type?: OscillatorType; onDone?: () => void } = {},
  ): SoundHandle {
    const ctx = this.enabled ? this.ensure() : null
    if (!ctx || !this.master) return { stop: () => {} }
    const gainLevel = opts.gain ?? 0.15
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = opts.type ?? 'sine'
    osc.frequency.value = freqHz
    g.gain.value = 0
    osc.connect(g).connect(this.master)
    const start = ctx.currentTime + 0.05
    osc.start(start)

    const schedule = (offset: number) => {
      for (const s of segments) {
        const a = offset + s.startS
        const b = a + s.durationS
        g.gain.setValueAtTime(0, a)
        g.gain.linearRampToValueAtTime(gainLevel, a + RAMP)
        g.gain.setValueAtTime(gainLevel, Math.max(a + RAMP, b - RAMP))
        g.gain.linearRampToValueAtTime(0, b)
      }
    }

    let timer: number | undefined
    let stopped = false
    if (opts.loopPeriodS) {
      const period = opts.loopPeriodS
      let next = start
      const pump = () => {
        if (stopped) return
        while (next < ctx.currentTime + 1.5) {
          schedule(next)
          next += period
        }
      }
      pump()
      timer = window.setInterval(pump, 250)
    } else {
      schedule(start)
      const end = segments.length ? Math.max(...segments.map((s) => s.startS + s.durationS)) : 0
      osc.stop(start + end + 0.05)
      osc.onended = () => {
        if (!stopped) opts.onDone?.()
        h.stop()
      }
    }
    const h = this.track({
      stop: () => {
        if (stopped) return
        stopped = true
        window.clearInterval(timer)
        const now = ctx.currentTime
        g.gain.cancelScheduledValues(now)
        g.gain.setTargetAtTime(0, now, 0.01)
        try {
          osc.stop(now + 0.05)
        } catch {
          /* already stopped */
        }
      },
      setGain: () => {},
    })
    return h
  }

  /** Continuous band-limited noise (radio hiss, HF static). Adjust with setGain. */
  noise(opts: { gain?: number; lowpassHz?: number; highpassHz?: number; crackle?: boolean } = {}): SoundHandle {
    const ctx = this.enabled ? this.ensure() : null
    if (!ctx || !this.master) return { stop: () => {}, setGain: () => {} }
    const len = ctx.sampleRate * 2
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) {
      let v = Math.random() * 2 - 1
      // Occasional impulses for atmospheric static.
      if (opts.crackle && Math.random() < 0.0008) v *= 6
      data[i] = v
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = opts.highpassHz ?? 300
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = opts.lowpassHz ?? 3000
    const g = ctx.createGain()
    g.gain.value = 0
    g.gain.setTargetAtTime(opts.gain ?? 0.05, ctx.currentTime, 0.05)
    src.connect(hp).connect(lp).connect(g).connect(this.master)
    src.start()
    return this.track({
      stop: () => {
        g.gain.setTargetAtTime(0, ctx.currentTime, 0.03)
        try {
          src.stop(ctx.currentTime + 0.15)
        } catch {
          /* already stopped */
        }
      },
      setGain: (v: number) => g.gain.setTargetAtTime(v, ctx.currentTime, 0.05),
    })
  }

  /**
   * The alert chime: two short falling tones. Callers post the caption
   * ("Integrity alert", "LPV lost") so the sound is never the only cue.
   */
  chime(opts: { gain?: number } = {}): SoundHandle {
    const g = opts.gain ?? 0.12
    const hs = [this.tone(880, 0.18, { gain: g, type: 'triangle' }), this.tone(660, 0.26, { gain: g, type: 'triangle', delayS: 0.2 })]
    return { stop: () => hs.forEach((h) => h.stop()) }
  }
}

const NO_SOUND: SoundHandle = { stop: () => {} }
const reportedAudioErrors = new Set<string>()

// A sound that fails to build (a node the browser rejects, a value it will not take)
// must never throw into the caller: most sounds start from a simulation step.
for (const name of ['tone', 'keyed', 'noise', 'chime'] as const) {
  const impl = AudioEngine.prototype[name] as (...args: unknown[]) => SoundHandle
  ;(AudioEngine.prototype as unknown as Record<string, unknown>)[name] = function (this: AudioEngine, ...args: unknown[]) {
    try {
      return impl.apply(this, args)
    } catch (error) {
      const msg = `${name}: ${String(error)}`
      if (!reportedAudioErrors.has(msg)) {
        reportedAudioErrors.add(msg)
        console.error('Sound failed:', error)
      }
      return NO_SOUND
    }
  }
}

export const audio = new AudioEngine()

// Stop sounds when muted.
usePrefs.subscribe((s, prev) => {
  if (prev.soundOn && !s.soundOn) audio.stopAll()
})
