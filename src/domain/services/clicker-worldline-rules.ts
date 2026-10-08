/**
 * Worldline rules (pure): each of worldlines 1-8 carries one rule, a "+" and a "−" that offset
 * each other so a worldline plays differently without moving the 8-hour pace (playtime-sim guard).
 * The engine only asks `worldlineRuleEffects(worldline)` for a neutral-by-default effect set.
 */

import type { WorldlineRuleDef, WorldlineRuleEffects } from "../entities/clicker.ts"

export type { WorldlineRuleDef, WorldlineRuleEffects }

export const NEUTRAL_RULE_EFFECTS: Readonly<WorldlineRuleEffects> = Object.freeze({
  clickMultiplier: 1,
  productionMultiplier: 1,
  feverDurationMultiplier: 1,
  feverCooldownMultiplier: 1,
  bossHpMultiplier: 1,
  bossRewardMultiplier: 1,
  comboMaxMultiplier: 1,
  comboWindowMultiplier: 1,
  skillEffectMultiplier: 1,
  skillCostMultiplier: 1,
  regionCurrencyMultiplier: 1,
  coreMultiplier: 1,
  timeScale: 1,
})

export function worldlineRuleFor(rules: readonly WorldlineRuleDef[], worldline: number): WorldlineRuleDef | null {
  if (!Number.isFinite(worldline)) return null
  return rules.find((r) => r.worldline === Math.floor(worldline)) ?? null
}

/** Effect set for a worldline; missing rule or missing fields are neutral (1). */
export function worldlineRuleEffects(rules: readonly WorldlineRuleDef[], worldline: number): WorldlineRuleEffects {
  const rule = worldlineRuleFor(rules, worldline)
  if (!rule) return NEUTRAL_RULE_EFFECTS
  const out = { ...NEUTRAL_RULE_EFFECTS }
  for (const [k, v] of Object.entries(rule.effects)) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) out[k as keyof WorldlineRuleEffects] = v
  }
  return out
}

/** Scale a buff multiplier's bonus part: 1.5 with ×1.2 effect → 1.6. Never below 1 for a bonus. */
export function scaleBuffBonus(multiplier: number, effect: number): number {
  if (!(multiplier > 1)) return multiplier
  return 1 + (multiplier - 1) * effect
}

/**
 * The "+" and "−" of a rule, as one number each: every rule pairs exactly one boost with one cost.
 * Used by the balance test: the pair's product stays near 1.
 */
export function rulePairProduct(rule: WorldlineRuleDef): number {
  return Object.values(rule.effects).reduce<number>((p, v) => p * (typeof v === "number" ? v : 1), 1)
}

/** Text for UI / screen readers: "균형 · + 채굴 +20% · − 자동 생산 −17%". */
export function worldlineRuleText(rule: WorldlineRuleDef): string {
  return `${rule.name} · ${rule.plus} · ${rule.minus}`
}

/** The rule to announce when the worldline changes from `prev` to `next` (null at load, same worldline, or no rule). */
export function worldlineRuleReveal(rules: readonly WorldlineRuleDef[], prev: number | null, next: number): WorldlineRuleDef | null {
  if (prev == null || !(next > prev)) return null
  return worldlineRuleFor(rules, next)
}
