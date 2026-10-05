/**
 * Worldline economy (pure): how prices, carried power and the fold goal move from one rebirth to
 * the next. Kept apart from the engine so balance work and its tests never touch game state.
 */

/** Rebirth counts come from saves: anything that is not a whole count >= 0 counts as 0. */
function wholeRebirths(rebirths: number): number {
  return Number.isFinite(rebirths) && rebirths > 0 ? Math.floor(rebirths) : 0
}

/**
 * Price level after `rebirths` rebirths: compounding `growth` per rebirth (1.15 = +15 %).
 * A growth below 1 would make later worldlines cheaper, so it is clamped to "no change".
 */
export function worldlinePriceScale(rebirths: number, growth: number): number {
  return Math.max(1, growth) ** wholeRebirths(rebirths)
}

/** Permanent click & production multiplier after `rebirths` rebirths: (1 + bonus) each. */
export function worldlinePowerMultiplier(rebirths: number, bonus: number): number {
  return (1 + Math.max(0, bonus)) ** wholeRebirths(rebirths)
}

/** Lifetime CORE that folds the worldline after `rebirths` rebirths (base × growth^n × table entry). */
export function worldlineGoalValue(base: number, growth: number, table: readonly number[] | undefined, rebirths: number): number {
  const n = wholeRebirths(rebirths)
  return base * growth ** n * (table?.[n] ?? 1)
}

/** Share of a whole run (minutes) each worldline is meant to take; the table must sum to the playtime target. */
export function playtimeShares(targetMinutes: readonly number[]): number[] {
  const total = targetMinutes.reduce((a, b) => a + b, 0)
  return total > 0 ? targetMinutes.map((m) => m / total) : targetMinutes.map(() => 0)
}
