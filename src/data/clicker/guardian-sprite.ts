import type { GroundShadowSpec, GroundedSprite, Tier } from "../../domain/services/clicker-grounded-fit.ts"
import type { ClipName } from "../../domain/services/clicker-guardian-motion.ts"

/*
 * Core Guardian frame sheet: transparent WebP frames, a waist-up torso whose broken-rock base sits
 * on the last opaque row (the "feet" / ground line) of every frame. All numbers are pixels of the
 * `tight` frames (1764x1022); `big` is the same picture at 1.5x. If the art is redrawn, re-measure
 * the numbers here only (guarded against the real files by clicker-guardian-frame.test).
 */

export const GUARDIAN_SPRITE: GroundedSprite = {
  size: { w: 1764, h: 1022 },
  /** Centre of the feet row: every frame ends on y = 1020, symmetric about x = 882. */
  pivot: { x: 882, y: 1020 },
  /** Alpha bounding box over the idle + hit frames (horn tips to the broken base). */
  body: { x: 39, y: 56, w: 1688, h: 964 },
}

/** Ground contact shadow (shadow.png cropped to its alpha box), relative to the pivot. */
export const GUARDIAN_SHADOW: GroundShadowSpec = {
  size: { w: 1205, h: 91 },
  offset: { x: -602, y: -43 },
}
export const GUARDIAN_SHADOW_SRC = "/clicker/boss/guardian/shadow.webp"

export type GuardianTier = Tier & { readonly dir: string }
export const GUARDIAN_TIERS: readonly GuardianTier[] = [
  { id: "tight", scaleVsBase: 1, dir: "/clicker/boss/guardian/tight" },
  { id: "big", scaleVsBase: 1.5, dir: "/clicker/boss/guardian/big" },
]

export const guardianFrameSrc = (tier: GuardianTier, clip: ClipName, index: number): string =>
  `${tier.dir}/${clip}_${String(index).padStart(2, "0")}.webp`
