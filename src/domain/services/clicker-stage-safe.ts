/*
 * Stage safe area (pure domain math — no DOM, no framework).
 *
 * The stage is the play area; overlays (hub dock, side panels) sit on it. Turn the overlay rects
 * into insets and the stage minus those insets is the room a boss may use. Only numbers in, numbers out.
 */

export type Size = { readonly w: number; readonly h: number }
export type Rect = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
export type Insets = { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number }

export type InsetOptions = {
  /** Breathing room kept between the boss and any overlay, px. */
  readonly gap?: number
  /** Never leave less than this fraction of each stage dimension to the boss. */
  readonly minSafeFraction?: number
  /** Margin kept free along every stage edge, px. */
  readonly edge?: number
}

const valid = (n: number) => Number.isFinite(n) && n > 0

export function isSize(s: Size): boolean {
  return valid(s.w) && valid(s.h)
}

/**
 * An overlay in the lower half of the stage claims the band below its top edge, one in the upper
 * half claims the band above its bottom edge; tall overlays hugging a side claim that side.
 * Zero-sized (hidden) overlays are ignored.
 */
export function insetsFromObstacles(stage: Size, obstacles: readonly Rect[], opts: InsetOptions = {}): Insets {
  const zero: Insets = { top: 0, right: 0, bottom: 0, left: 0 }
  if (!isSize(stage)) return zero
  const gap = opts.gap ?? 12
  const edge = Math.max(0, opts.edge ?? 0)
  let top = edge
  let bottom = edge
  let left = edge
  let right = edge
  for (const o of obstacles) {
    if (!valid(o.w) || !valid(o.h)) continue
    const x1 = o.x + o.w
    const y1 = o.y + o.h
    if (x1 <= 0 || y1 <= 0 || o.x >= stage.w || o.y >= stage.h) continue
    const tallSide = o.h >= stage.h * 0.3 && o.w < stage.w * 0.5
    if (tallSide && o.x <= 2) left = Math.max(left, x1 + gap)
    else if (tallSide && x1 >= stage.w - 2) right = Math.max(right, stage.w - o.x + gap)
    else if (o.y + o.h / 2 >= stage.h / 2) bottom = Math.max(bottom, stage.h - o.y + gap)
    else top = Math.max(top, y1 + gap)
  }
  return capInsets(stage, { top, right, bottom, left }, opts.minSafeFraction ?? 0.3)
}

/** Shrinks insets proportionally so the safe area never collapses below `minFraction` of the stage. */
export function capInsets(stage: Size, insets: Insets, minFraction: number): Insets {
  const fit = (a: number, b: number, total: number) => {
    const max = total * (1 - minFraction)
    const sum = a + b
    return sum > max && sum > 0 ? [(a * max) / sum, (b * max) / sum] : [a, b]
  }
  const [top, bottom] = fit(insets.top, insets.bottom, stage.h)
  const [left, right] = fit(insets.left, insets.right, stage.w)
  return { top: top!, bottom: bottom!, left: left!, right: right! }
}

export function safeRect(stage: Size, insets: Insets): Rect {
  return {
    x: insets.left,
    y: insets.top,
    w: Math.max(0, stage.w - insets.left - insets.right),
    h: Math.max(0, stage.h - insets.top - insets.bottom),
  }
}

/** True when `inner` lies completely inside `outer` (within `eps` px). */
export function rectInside(inner: Rect, outer: Rect, eps = 0.01): boolean {
  return (
    inner.x >= outer.x - eps &&
    inner.y >= outer.y - eps &&
    inner.x + inner.w <= outer.x + outer.w + eps &&
    inner.y + inner.h <= outer.y + outer.h + eps
  )
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}
