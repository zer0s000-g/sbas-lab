import { describe, expect, it } from 'vitest'
import {
  createClock,
  DEFAULT_SPEEDS,
  MAX_FRAME_S,
  nearestSpeed,
  pause,
  play,
  realToSignalUs,
  setSpeed,
  slowdownFactor,
  slowMotionFor,
  slowMotionLabel,
  speedLabel,
  stepSpeed,
  tickClock,
  togglePlay,
} from '@/core/clock'

describe('simulation clock', () => {
  it('offers the journey time-lapse steps 1× to 60×', () => {
    expect([...DEFAULT_SPEEDS]).toEqual([1, 2, 4, 8, 16, 30, 60])
  })
  it('advances by real time × speed', () => {
    const c = setSpeed(createClock(), 2)
    const { state, dt } = tickClock(c, 0.05)
    expect(dt).toBeCloseTo(0.1)
    expect(state.timeS).toBeCloseTo(0.1)
  })
  it('does not advance while paused', () => {
    const { dt, state } = tickClock(pause(createClock()), 0.05)
    expect(dt).toBe(0)
    expect(state.timeS).toBe(0)
    expect(play(pause(createClock())).running).toBe(true)
    expect(togglePlay(createClock()).running).toBe(false)
  })
  it('clamps long frames so a hidden tab does not cause a jump', () => {
    const { dt } = tickClock(createClock(), 5)
    expect(dt).toBeCloseTo(MAX_FRAME_S)
  })
  it('ignores zero, negative and NaN frame times', () => {
    expect(tickClock(createClock(), 0).dt).toBe(0)
    expect(tickClock(createClock(), -1).dt).toBe(0)
    expect(tickClock(createClock(), Number.NaN).dt).toBe(0)
  })
  it('snaps speeds to allowed steps and steps up/down', () => {
    expect(nearestSpeed(3)).toBe(4)
    expect(nearestSpeed(0.3)).toBe(1)
    expect(nearestSpeed(25)).toBe(30)
    expect(nearestSpeed(1000)).toBe(60)
    const c = createClock()
    expect(stepSpeed(c, 1).speed).toBe(2)
    expect(stepSpeed(stepSpeed(c, -1), -1).speed).toBe(1)
    expect(stepSpeed(setSpeed(c, 60), 1).speed).toBe(60)
  })
  it('supports custom speed ranges', () => {
    const c = createClock({ speeds: [1, 10, 60], speed: 60 })
    expect(c.speed).toBe(60)
    expect(tickClock(c, 0.05).dt).toBeCloseTo(3)
  })
  it('labels speeds honestly', () => {
    expect(speedLabel(1)).toBe('Real time')
    expect(speedLabel(4)).toBe('Sped up 4×')
    expect(speedLabel(0.25)).toBe('Slowed down 0.25×')
    expect(speedLabel(30)).toBe('Sped up 30×')
  })
})

describe('slow motion for signals', () => {
  it('plays an event in the requested real time', () => {
    const sm = slowMotionFor(200, 4) // 200 µs in 4 s
    let t = 0
    for (let i = 0; i < 80; i++) t += realToSignalUs(0.05, sm)
    expect(t).toBeCloseTo(200)
  })
  it('reports the slowdown factor and a friendly label', () => {
    const sm = slowMotionFor(10, 1) // 1 s shows 10 µs → 100,000× slower
    expect(slowdownFactor(sm)).toBeCloseTo(100000)
    expect(slowMotionLabel(sm)).toBe('1 second on screen = 10 microseconds of real time')
    expect(slowMotionLabel(slowMotionFor(2000, 1))).toBe('1 second on screen = 2 milliseconds of real time')
  })
})
