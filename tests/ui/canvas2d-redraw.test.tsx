// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { Canvas2D, MAX_DPR } from '@/components/Canvas2D'

// A hand-driven requestAnimationFrame: flush() runs the frames queued so far.
let queue = new Map<number, FrameRequestCallback>()
let nextId = 1
let now = 0
function flush(frames = 1) {
  for (let i = 0; i < frames; i++) {
    const due = [...queue.values()]
    queue = new Map()
    now += 16
    act(() => due.forEach((cb) => cb(now)))
  }
}

// One fake resolution media query per devicePixelRatio, recording its listeners.
let queries: { media: string; listeners: Set<() => void> }[] = []
let observed: (() => void)[] = []

beforeEach(() => {
  queue = new Map()
  queries = []
  observed = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => (queue.set(nextId, cb), nextId++))
  vi.stubGlobal('cancelAnimationFrame', (id: number) => queue.delete(id))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(cb: () => void) {
        observed.push(cb)
      }
      observe() {}
      disconnect() {}
    },
  )
  vi.stubGlobal('matchMedia', (media: string) => {
    const q = { media, listeners: new Set<() => void>() }
    queries.push(q)
    return {
      media,
      matches: true,
      addEventListener: (_: string, l: () => void) => q.listeners.add(l),
      removeEventListener: (_: string, l: () => void) => q.listeners.delete(l),
    }
  })
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 200, height: 100, top: 0, left: 0, right: 200, bottom: 100, x: 0, y: 0, toJSON() {} })
  HTMLCanvasElement.prototype.getContext = function () {
    return { setTransform() {}, clearRect() {} } as unknown as CanvasRenderingContext2D
  } as unknown as typeof HTMLCanvasElement.prototype.getContext
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Canvas2D redraws', () => {
  it('with a frameKey, draws only when the key changes', () => {
    let key: unknown[] = [1, 'a']
    const draw = vi.fn()
    render(<Canvas2D draw={draw} frameKey={() => key} label="scope" />)
    const mounted = draw.mock.calls.length // the first measurement draws
    flush(2) // the first frame only primes the timer; the next one draws once
    expect(draw.mock.calls.length).toBe(mounted + 1)
    flush(10)
    expect(draw.mock.calls.length).toBe(mounted + 1)
    key = [1, 'a'] // a new array with the same items is the same key
    flush(3)
    expect(draw.mock.calls.length).toBe(mounted + 1)
    key = [2, 'a']
    flush(3)
    expect(draw.mock.calls.length).toBe(mounted + 2)
  })

  it('a new draw function is drawn on the next frame', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = render(<Canvas2D draw={first} frameKey={() => 'same'} label="scope" />)
    flush(5)
    rerender(<Canvas2D draw={second} frameKey={() => 'same'} label="scope" />)
    flush(1)
    expect(second).toHaveBeenCalledTimes(1)
    flush(5)
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('without a frameKey, an animated canvas still draws every frame', () => {
    const draw = vi.fn()
    render(<Canvas2D draw={draw} label="scope" />)
    const mounted = draw.mock.calls.length
    flush(6)
    expect(draw.mock.calls.length).toBe(mounted + 5)
    expect(screen.getByRole('img', { name: 'scope' })).toBeTruthy()
  })
})

describe('Canvas2D pixel ratio', () => {
  it('clamps the device pixel ratio to 1..2', () => {
    vi.stubGlobal('devicePixelRatio', 3)
    render(<Canvas2D draw={() => {}} animate={false} label="scope" />)
    const c = screen.getByRole('img', { name: 'scope' }) as HTMLCanvasElement
    expect(MAX_DPR).toBe(2)
    expect(c.width).toBe(400)
    expect(c.height).toBe(200)
  })

  it('re-measures when the pixel ratio changes, and stops listening on unmount', () => {
    vi.stubGlobal('devicePixelRatio', 1)
    const draw = vi.fn()
    const { unmount } = render(<Canvas2D draw={draw} animate={false} label="scope" />)
    const c = screen.getByRole('img', { name: 'scope' }) as HTMLCanvasElement
    expect(c.width).toBe(200)
    expect(queries.at(-1)!.media).toBe('(resolution: 1dppx)')
    // Browser zoom to 150 %: the 1dppx query stops matching.
    vi.stubGlobal('devicePixelRatio', 1.5)
    const calls = draw.mock.calls.length
    act(() => queries.at(-1)!.listeners.forEach((l) => l()))
    expect(c.width).toBe(300)
    expect(draw.mock.calls.length).toBe(calls + 1)
    // Now it watches the new ratio, and only that one.
    expect(queries.at(-1)!.media).toBe('(resolution: 1.5dppx)')
    expect(queries.filter((q) => q.listeners.size > 0)).toHaveLength(1)
    unmount()
    expect(queries.filter((q) => q.listeners.size > 0)).toHaveLength(0)
  })
})
