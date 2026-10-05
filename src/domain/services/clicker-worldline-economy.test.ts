import assert from "node:assert/strict"
import test from "node:test"
import { clickerConfig as config } from "../../data/clicker/catalog.ts"
import { playtimeShares, worldlineGoalValue, worldlinePowerMultiplier, worldlinePriceScale } from "./clicker-worldline-economy.ts"

test("price scale compounds a small step per rebirth", () => {
  assert.equal(worldlinePriceScale(0, 1.15), 1)
  assert.ok(Math.abs(worldlinePriceScale(1, 1.15) - 1.15) < 1e-12)
  assert.ok(Math.abs(worldlinePriceScale(8, 1.15) - 1.15 ** 8) < 1e-9)
  for (let n = 1; n <= 8; n++) {
    const step = worldlinePriceScale(n, 1.15) / worldlinePriceScale(n - 1, 1.15)
    assert.ok(Math.abs(step - 1.15) < 1e-12, `rebirth ${n} raises prices by the same +15%`)
  }
})

test("price scale never makes a later worldline cheaper and ignores bad rebirth counts", () => {
  assert.equal(worldlinePriceScale(5, 0.5), 1)
  assert.equal(worldlinePriceScale(-3, 1.15), 1)
  assert.equal(worldlinePriceScale(Number.NaN, 1.15), 1)
  assert.equal(worldlinePriceScale(2.9, 2), 4, "fractional counts floor")
})

test("power multiplier compounds (1 + bonus) per rebirth", () => {
  assert.equal(worldlinePowerMultiplier(0, 0.3), 1)
  assert.ok(Math.abs(worldlinePowerMultiplier(3, 0.3) - 1.3 ** 3) < 1e-12)
  assert.equal(worldlinePowerMultiplier(4, -1), 1, "a negative bonus cannot shrink power")
})

test("goal value is base × growth^n × table entry (missing entry = 1)", () => {
  assert.equal(worldlineGoalValue(10, 3, [2, 0.5], 0), 20)
  assert.equal(worldlineGoalValue(10, 3, [2, 0.5], 1), 15)
  assert.equal(worldlineGoalValue(10, 3, [2, 0.5], 2), 90)
  assert.equal(worldlineGoalValue(10, 3, undefined, 2), 90)
})

test("playtime shares add up to one", () => {
  const shares = playtimeShares([80, 60, 40])
  assert.ok(Math.abs(shares.reduce((a, b) => a + b, 0) - 1) < 1e-12)
  assert.deepEqual(playtimeShares([0, 0]), [0, 0])
})

test("catalog: prices rise only a little per rebirth (+10–20%), the whole run under ×4", () => {
  assert.ok(config.priceGrowth >= 1.1 && config.priceGrowth <= 1.2, `priceGrowth ${config.priceGrowth}`)
  assert.ok(worldlinePriceScale(8, config.priceGrowth) < 4)
})

test("catalog: carried power stays level with the price rise, so late ramps do not blow up", () => {
  // Growth of income scales with (loaded power / price): a rebirth must not add more power than it adds price.
  assert.ok(1 + config.worldlineBonus <= config.priceGrowth)
  let buffs = 1
  for (const t of config.transcendence) {
    const m = Math.max(t.clickMultiplier ?? 1, t.productionMultiplier ?? 1)
    assert.ok(m <= 1.1, `${t.id} worldline buff ×${m}`)
    buffs *= m
  }
  assert.ok(buffs < 1.6, `all eight buffs together ×${buffs.toFixed(2)}`)
  for (const r of config.relics ?? []) {
    for (const m of [r.perLevel.clickMultiplier, r.perLevel.productionMultiplier]) assert.ok((m ?? 1) <= 1.2, `${r.id} per level ×${m}`)
  }
})

test("catalog: the goal table never lets a later worldline's goal drop", () => {
  const goals = Array.from({ length: 9 }, (_, n) => worldlineGoalValue(config.rebirthEnergy, config.rebirthGrowth, config.rebirthGoalScale, n))
  for (let n = 1; n < goals.length; n++) assert.ok(goals[n] >= goals[n - 1], `goal ${n + 1} (${goals[n]}) below goal ${n} (${goals[n - 1]})`)
})
