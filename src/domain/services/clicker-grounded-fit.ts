import type { Rect, Size } from "./clicker-stage-safe.ts"

/*
 * Feet-anchored placement for a cut-out sprite (pure). The sprite stands on a ground line: the
 * picture's pivot (centre of its feet row) is pinned to (slot centre, slot bottom) and the scale is
 * the largest one that keeps the sprite's body, plus headroom for motion, inside the slot. Every
 * motion transform in the UI uses the same pivot, so the feet never leave the ground line.
 * All sprite numbers are pixels of the BASE image; other resolutions of the same art are the same
 * picture at `scaleVsBase` x (see pickTier).
 */

export type Point = { readonly x: number; readonly y: number }

export type GroundedSprite = {
  /** Size of the base image (px). */
  readonly size: Size
  /** Feet pivot in the base image: horizontal centre of the body, the last opaque row. */
  readonly pivot: Point
  /** Bounding box of the body in the base image (px); the part that must stay in view. */
  readonly body: Rect
}

export type GroundedOptions = {
  /** Extra room above the head for stretch / lunge / appear overshoot (fraction of body height). */
  readonly padTop?: number
  /** Extra room to each side for widening / lean (fraction of body half-width). */
  readonly padSide?: number
  /** Cap on the displayed image height (px), e.g. 115 % of the screen height. */
  readonly maxImageHeight?: number
  /** Cap on the scale vs the base image. */
  readonly maxScale?: number
}

export type GroundedPlacement = {
  /** Displayed px per base-image px. */
  readonly scale: number
  /** Displayed image box (px, same space as the slot). */
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
  /** y of the ground line = the feet row. */
  readonly groundY: number
  /** x of the pivot (centre line). */
  readonly pivotX: number
  /** Where the body lies once placed. */
  readonly body: Rect
}

const valid = (n: number) => Number.isFinite(n) && n > 0

/**
 * `slot` is the room the body may use: its bottom edge is the ground line, its middle is the
 * pivot's x. Returns null for a degenerate slot or sprite.
 */
export function groundedPlacement(slot: Rect, sprite: GroundedSprite, opts: GroundedOptions = {}): GroundedPlacement | null {
  const { size, pivot, body } = sprite
  if (!valid(slot.w) || !valid(slot.h) || !valid(size.w) || !valid(size.h) || !valid(body.w) || !valid(body.h)) return null
  const above = pivot.y - body.y
  const halfW = Math.max(pivot.x - body.x, body.x + body.w - pivot.x)
  if (!valid(above) || !valid(halfW)) return null
  const padTop = Math.max(0, opts.padTop ?? 0)
  const padSide = Math.max(0, opts.padSide ?? 0)
  const limits = [slot.w / (2 * halfW * (1 + padSide)), slot.h / (above * (1 + padTop))]
  if (opts.maxImageHeight !== undefined && valid(opts.maxImageHeight)) limits.push(opts.maxImageHeight / size.h)
  if (opts.maxScale !== undefined && valid(opts.maxScale)) limits.push(opts.maxScale)
  const scale = Math.min(...limits)
  const pivotX = slot.x + slot.w / 2
  const groundY = slot.y + slot.h
  const left = pivotX - pivot.x * scale
  const top = groundY - pivot.y * scale
  return {
    scale,
    left,
    top,
    width: size.w * scale,
    height: size.h * scale,
    groundY,
    pivotX,
    body: { x: left + body.x * scale, y: top + body.y * scale, w: body.w * scale, h: body.h * scale },
  }
}

/**
 * The ground slot inside a safe area: `head` px are kept free at the top (name / HP bars) and
 * `foot` px at the bottom (gap above the dock). The ground line is the slot's bottom edge, so it
 * stays put whether or not the fight is running.
 */
export function groundSlot(safe: Rect, head: number, foot: number): Rect {
  const h = Math.max(0, safe.h - Math.max(0, head) - Math.max(0, foot))
  return { x: safe.x, y: safe.y + Math.max(0, head), w: safe.w, h }
}

export type Tier = { readonly id: string; /** Pixels of this resolution per base-image pixel. */ readonly scaleVsBase: number }

/**
 * Cheapest resolution that still looks sharp: the smallest tier whose pixel density covers
 * `scale x dpr` (a little slack, `tolerance`, before moving up). Falls back to the largest tier.
 */
export function pickTier(tiers: readonly Tier[], scale: number, dpr = 1, tolerance = 0.02): Tier {
  const sorted = [...tiers].sort((a, b) => a.scaleVsBase - b.scaleVsBase)
  const need = (Number.isFinite(scale) && scale > 0 ? scale : 1) * (Number.isFinite(dpr) && dpr > 0 ? dpr : 1)
  return sorted.find((t) => need <= t.scaleVsBase * (1 + tolerance)) ?? sorted[sorted.length - 1]!
}

export type GroundShadowSpec = {
  /** Size of the shadow image in base-image px. */
  readonly size: Size
  /** Top-left of the shadow image relative to the pivot (base px); the ellipse straddles the ground line. */
  readonly offset: Point
}

/** Shadow box (px) under a placement; `widen` stretches it around the pivot (squash / lunge). */
export function groundShadowRect(p: GroundedPlacement, spec: GroundShadowSpec, widen = 1): Rect {
  const w = spec.size.w * p.scale * widen
  const h = spec.size.h * p.scale
  return { x: p.pivotX + spec.offset.x * p.scale * widen, y: p.groundY + spec.offset.y * p.scale, w, h }
}
