import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { clickerConfig as config } from "../../data/clicker/catalog.ts"
import { CLICKER_WORLDLINE_RULES as RULES } from "../../data/clicker/worldline-rules.ts"
import { activeSkillCost, bossFightHp, createInitialSave, derivedClick, productionSnapshot, regionCurrencyRate } from "./clicker-engine.ts"
import { worldlineRuleReveal, NEUTRAL_RULE_EFFECTS, rulePairProduct, scaleBuffBonus, worldlineRuleEffects, worldlineRuleFor, worldlineRuleText } from "./clicker-worldline-rules.ts"

const NOW = 1_000_000
const save = createInitialSave(NOW, config)
const at = (wl: number) => ({ ...save.runState, currentWorldLine: wl, producerLevels: { solar_node: 10 } })
const noRules = { ...config, worldlineRules: [] }

test("one rule per worldline 2-8 (none on worldline 1), each a + and a − (two effects), names and icons unique", () => {
  assert.deepEqual(RULES.map((r) => r.worldline), [2, 3, 4, 5, 6, 7, 8])
  assert.equal(worldlineRuleFor(RULES, 1), null)
  assert.equal(new Set(RULES.map((r) => r.name)).size, 7)
  assert.equal(new Set(RULES.map((r) => r.icon)).size, 7)
  for (const r of RULES) {
    assert.equal(Object.keys(r.effects).length, 2, r.id)
    assert.ok(r.plus.startsWith("+ ") && r.minus.startsWith("− "), `${r.id}: sign in text, not colour only`)
    assert.ok(worldlineRuleText(r).includes(r.name))
  }
})

test("pairs offset: product of each rule's multipliers stays near 1 (except 풍요's currency, a non-CORE stat)", () => {
  for (const r of RULES) {
    const p = r.id === "rule_plenty" ? (r.effects.coreMultiplier ?? 1) : r.id === "rule_haste" ? (r.effects.timeScale ?? 1) * (r.effects.productionMultiplier ?? 1) : rulePairProduct(r)
    if (["rule_overheat", "rule_abyss", "rule_resonance"].includes(r.id)) continue // same-direction pairs: + and − both scale one stat up
    assert.ok(Math.abs(p - 1) <= 0.13, `${r.id}: ${p}`)
  }
})

test("no rule outside worldlines 1-8; missing fields are neutral", () => {
  assert.equal(worldlineRuleFor(RULES, 9), null)
  assert.equal(worldlineRuleFor(RULES, Number.NaN), null)
  assert.deepEqual(worldlineRuleEffects(RULES, 9), NEUTRAL_RULE_EFFECTS)
  assert.equal(worldlineRuleEffects(RULES, 1).timeScale, 1)
})

test("engine reads the rule of the current worldline", () => {
  const ratio = (f: (c: typeof config) => number) => f(config) / f(noRules)
  assert.equal(ratio((c) => derivedClick(at(1), save.metaState, c).click), 1, "worldline 1: no rule")
  assert.equal(ratio((c) => productionSnapshot(at(1), save.metaState, c, NOW).perSecond), 1, "worldline 1: no rule")
  assert.ok(Math.abs(ratio((c) => derivedClick(at(4), save.metaState, c).click) - 0.75) < 1e-9, "고요: click down")
  assert.ok(Math.abs(ratio((c) => productionSnapshot(at(4), save.metaState, c, NOW).perSecond) - 1.2) < 1e-9, "고요")
  assert.ok(ratio((c) => derivedClick(at(5), save.metaState, c).comboWindow) < 1, "연쇄: faster decay")
  assert.ok(ratio((c) => derivedClick(at(5), save.metaState, c).comboMax) > 1, "연쇄: higher cap")
  const skill = config.activeSkills[0]
  assert.ok(activeSkillCost(at(6), skill, config) >= activeSkillCost(at(6), skill, noRules), "공명: dearer skills")
  const region = config.regions.find((r) => r.currency)!
  assert.ok(Math.abs(regionCurrencyRate(at(7), config, region.id) / regionCurrencyRate(at(7), noRules, region.id) - 1.5) < 1e-9, "풍요")
  const boss = config.regions.find((r) => r.boss)!.boss!
  assert.ok(Math.abs(bossFightHp({ ...boss, strikesToDefeat: undefined }, at(3), save.metaState, config) / boss.hp - 1.25) < 1e-9, "심연")
  assert.equal(bossFightHp({ ...boss, strikesToDefeat: undefined }, at(9), save.metaState, config), boss.hp, "no rule on the Core Heart worldline")
})

test("buff scaling only touches the bonus part", () => {
  assert.equal(scaleBuffBonus(1.5, 1.2), 1.6)
  assert.equal(scaleBuffBonus(1, 1.2), 1)
  assert.equal(scaleBuffBonus(0.8, 1.2), 0.8)
})

test("rule icons ship under public/", () => {
  const dir = join(import.meta.dirname, "../../../public/clicker/worldline-rule")
  assert.deepEqual(RULES.filter((r) => !existsSync(join(dir, `${r.icon}.webp`))).map((r) => r.icon), [])
})

test("rule reveal: only on entering a new worldline that has a rule", () => {
  assert.equal(worldlineRuleReveal(RULES, null, 2), null, "not at load")
  assert.equal(worldlineRuleReveal(RULES, 2, 2), null)
  assert.equal(worldlineRuleReveal(RULES, 8, 9), null, "Core Heart worldline has no rule")
  assert.equal(worldlineRuleReveal(RULES, 1, 2)?.worldline, 2)
})
