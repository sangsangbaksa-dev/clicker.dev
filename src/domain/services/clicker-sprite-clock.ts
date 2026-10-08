/*
 * Sprite animation clock (pure). A clip is a handful of frames played at a fixed rate; the clock
 * turns elapsed time into "frame a, frame b, how far between them" so the renderer can crossfade
 * with an easing curve instead of snapping from frame to frame. No DOM, no timers.
 */

export type Clip = {
  readonly frames: number
  readonly fps: number
  /** true = wraps around (last frame blends into the first), false = plays once and holds the last frame. */
  readonly loop: boolean
}

export type Easing = (x: number) => number

export const clamp01 = (x: number): number => (x <= 0 ? 0 : x >= 1 ? 1 : x)
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

export const linear: Easing = (x) => clamp01(x)
export const smoothstep: Easing = (x) => {
  const t = clamp01(x)
  return t * t * (3 - 2 * t)
}
export const easeOutCubic: Easing = (x) => 1 - (1 - clamp01(x)) ** 3
export const easeInCubic: Easing = (x) => clamp01(x) ** 3
export const easeInOutSine: Easing = (x) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(x))
/** Overshoots past 1 and settles back (c = overshoot strength). */
export const easeOutBack = (x: number, c = 1.70158): number => {
  const t = clamp01(x) - 1
  return 1 + (c + 1) * t ** 3 + c * t * t
}

export function clipDurationMs(clip: Clip): number {
  return clip.fps > 0 ? (clip.frames / clip.fps) * 1000 : 0
}

export type FrameMix = {
  /** Frame shown now. */
  readonly a: number
  /** Frame being blended in (same as `a` when nothing is blending). */
  readonly b: number
  /** Eased weight of `b`, 0..1. */
  readonly mix: number
  /** One-shot clips only: true once the whole clip has played. */
  readonly done: boolean
}

/**
 * Frame `i` is a keyframe at `i / fps`; between two keyframes the picture crossfades with `ease`.
 * A looping clip wraps (last -> first); a one-shot clip holds its last frame until `clipDurationMs`.
 */
export function sampleClip(clip: Clip, tMs: number, ease: Easing = smoothstep): FrameMix {
  const n = Math.max(1, Math.floor(clip.frames))
  const t = Math.max(0, Number.isFinite(tMs) ? tMs : 0)
  const u = (t / 1000) * clip.fps
  const i = Math.floor(u)
  const frac = u - i
  if (clip.loop) {
    if (n === 1) return { a: 0, b: 0, mix: 0, done: false }
    return { a: i % n, b: (i + 1) % n, mix: ease(frac), done: false }
  }
  const done = t >= clipDurationMs(clip)
  if (i >= n - 1) return { a: n - 1, b: n - 1, mix: 0, done }
  return { a: i, b: i + 1, mix: ease(frac), done: false }
}

/** Same sample, without any blending: snaps to the nearest earlier keyframe (reduced motion). */
export function sampleClipStepped(clip: Clip, tMs: number): FrameMix {
  const s = sampleClip(clip, tMs, () => 0)
  return { ...s, b: s.a }
}
