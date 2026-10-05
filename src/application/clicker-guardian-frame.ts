import {
  groundShadowRect,
  groundSlot,
  groundedPlacement,
  pickTier,
  type GroundedPlacement,
} from "../domain/services/clicker-grounded-fit.ts"
import { insetsFromObstacles, safeRect, type Rect, type Size } from "../domain/services/clicker-stage-safe.ts"
import { GUARDIAN_SHADOW, GUARDIAN_SPRITE, GUARDIAN_TIERS, type GuardianTier } from "../data/clicker/guardian-sprite.ts"

/*
 * Policy for standing the Core Guardian on the stage. The UI measures the stage + overlays and
 * calls `guardianLayout`; the maths is in the domain (clicker-grounded-fit), the art numbers in
 * data/clicker/guardian-sprite.
 */

/** What the UI measures: the stage size and the overlays on it (px, relative to the stage). */
export type StageMetrics = { readonly size: Size; readonly obstacles: readonly Rect[] }

/** Room kept between the guardian column and any overlay (px). */
export const GUARDIAN_GAP_PX = 14
/** Margin kept free along each stage edge (px). */
export const GUARDIAN_EDGE_PX = 12

/** The stage rect the guardian column may occupy: the stage minus the overlays on it (and a thin edge margin). */
export function guardianSafeArea(metrics: StageMetrics): Rect {
  return safeRect(metrics.size, insetsFromObstacles(metrics.size, metrics.obstacles, { gap: GUARDIAN_GAP_PX, edge: GUARDIAN_EDGE_PX }))
}

/**
 * Room kept free above the art (px) for the name + start button (idle) or the two HP bars (fight),
 * plus the "you fell" note. The start button lives up here so the picture can use the whole
 * height down to the dock.
 */
export const GUARDIAN_HEAD_PX = 92
/** Room kept free below the ground line (px): so the soft tail of the ground shadow stays clear of the hub dock; the ground line never moves during the fight. */
export const GUARDIAN_FOOT_PX = 16
/** Headroom above the head for stretch / lunge / appear overshoot (fraction of body height). */
export const GUARDIAN_PAD_TOP = 0.06
/** Room to each side for widening and lean (fraction of body half-width). */
export const GUARDIAN_PAD_SIDE = 0.03
/** The picture is never shown taller than this share of the screen height. */
export const GUARDIAN_MAX_SCREEN_HEIGHT = 1.15
/** The clickable area extends this far beyond the body (fraction of its size). */
export const GUARDIAN_HIT_MARGIN = 0.02

export type GuardianLayout = {
  /** The boss column: the stage's safe area (clear of the hub dock). Everything below is relative to its top-left. */
  readonly column: Rect
  /** The picture, feet on `art.groundY`. */
  readonly art: GroundedPlacement
  readonly tier: GuardianTier
  /** Contact shadow at rest. */
  readonly shadow: Rect
  /** Tap target: the body, a little generous. */
  readonly hit: Rect
}

const shift = (r: Rect, dx: number, dy: number): Rect => ({ x: r.x - dx, y: r.y - dy, w: r.w, h: r.h })

export function guardianLayout(metrics: StageMetrics, viewportHeight: number, dpr = 1): GuardianLayout | null {
  const safe = guardianSafeArea(metrics)
  const slot = groundSlot(safe, GUARDIAN_HEAD_PX, GUARDIAN_FOOT_PX)
  const placed = groundedPlacement(slot, GUARDIAN_SPRITE, {
    padTop: GUARDIAN_PAD_TOP,
    padSide: GUARDIAN_PAD_SIDE,
    maxImageHeight: Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight * GUARDIAN_MAX_SCREEN_HEIGHT : undefined,
  })
  if (!placed) return null
  const rel = (r: Rect) => shift(r, safe.x, safe.y)
  const art: GroundedPlacement = {
    ...placed,
    left: placed.left - safe.x,
    top: placed.top - safe.y,
    groundY: placed.groundY - safe.y,
    pivotX: placed.pivotX - safe.x,
    body: rel(placed.body),
  }
  const b = art.body
  const mx = b.w * GUARDIAN_HIT_MARGIN
  const my = b.h * GUARDIAN_HIT_MARGIN
  return {
    column: safe,
    art,
    tier: pickTier(GUARDIAN_TIERS, placed.scale, dpr) as GuardianTier,
    shadow: groundShadowRect(art, GUARDIAN_SHADOW),
    hit: { x: b.x - mx, y: b.y - my, w: b.w + 2 * mx, h: b.h + my },
  }
}
