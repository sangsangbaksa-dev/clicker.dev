/**
 * Gacha price curve (pure). The capsule price is `base × factor`, where `base` is the engine's
 * "ten minutes of income" and `factor` grows with every pull ever made:
 *
 *   ln factor(n) = ln(START) + LINEAR·n + QUAD·n²      (n = pulls already made)
 *
 * so the step-to-step ratio exp(LINEAR + QUAD·(2n+1)) itself keeps rising (accelerating growth).
 * `n` is capped, which bounds the factor (≈6e14) so prices can never reach Infinity/NaN.
 */
export const GACHA_PRICE_START = 8
export const GACHA_PRICE_LINEAR = 0.04
export const GACHA_PRICE_QUAD = 0.0006
export const GACHA_PRICE_PULL_CAP = 200

function safePulls(pulls: number): number {
  return Number.isFinite(pulls) ? Math.min(GACHA_PRICE_PULL_CAP, Math.max(0, Math.floor(pulls))) : 0
}

/** Price multiplier for the next pull, given how many pulls were already made. */
export function gachaPriceFactor(pullsMade: number): number {
  const n = safePulls(pullsMade)
  return GACHA_PRICE_START * Math.exp(GACHA_PRICE_LINEAR * n + GACHA_PRICE_QUAD * n * n)
}

/** Summed multiplier for `count` consecutive pulls starting after `pullsMade`. */
export function gachaBatchFactor(pullsMade: number, count: number): number {
  const first = safePulls(pullsMade)
  let sum = 0
  for (let i = 0; i < count; i++) sum += gachaPriceFactor(first + i)
  return sum
}
