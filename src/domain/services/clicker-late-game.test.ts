import assert from "node:assert/strict"
import test from "node:test"
import { clickerConfig as config } from "../../data/clicker/catalog.ts"
import {
  RELIC_UNLOCK_REBIRTHS,
  buyRelic,
  canRebirth,
  createInitialSave,
  derivedClick,
  isProducerUnlocked,
  isRegionUnlocked,
  productionSnapshot,
  relicCost,
  relicError,
  relicLevel,
  sanitizeSave,
} from "./clicker-engine.ts"

const NOW = 1_000_000

test("eight worldlines lead to the Core Heart", () => {
  assert.equal(config.transcendence.length, 8)
  assert.equal(new Set(config.transcendence.map((t) => t.id)).size, 8)
  const heart = config.regions.find((r) => r.boss)!
  assert.equal(heart.requiresRebirths, config.transcendence.length)
  const save = createInitialSave(NOW, config)
  const walked7 = { ...save.metaState, rebirthCount: 7, transcendenceIds: config.transcendence.slice(0, 7).map((t) => t.id) }
  const rich = { ...save.runState, currentWorldLine: 8, lifetimeCoreEnergy: Number.MAX_VALUE }
  assert.ok(canRebirth(rich, walked7, config), "the eighth worldline can still fold")
  assert.equal(isRegionUnlocked(rich, config, heart.id), false, "no heart before the eighth rebirth")
  assert.ok(isRegionUnlocked({ ...rich, currentWorldLine: 9 }, config, heart.id))
})

test("late producers only exist from their worldline on", () => {
  const late = config.producers.filter((p) => p.requiresWorldLine)
  assert.equal(late.length, 3)
  const run = { ...createInitialSave(NOW, config).runState, lifetimeCoreEnergy: Number.MAX_VALUE }
  for (const p of late) {
    assert.equal(isProducerUnlocked({ ...run, currentWorldLine: p.requiresWorldLine! - 1 }, config, p.id), false, p.id)
    assert.ok(isProducerUnlocked({ ...run, currentWorldLine: p.requiresWorldLine! }, config, p.id), p.id)
  }
  // Each late producer out-produces the one before it.
  const rates = config.producers.slice(-4).map((p) => p.productionPerSecond)
  for (let i = 1; i < rates.length; i++) assert.ok(rates[i] > rates[i - 1])
})

test("relic vault: opens on the fourth worldline, costs world currency, stays forever", () => {
  const save = createInitialSave(NOW, config)
  const relic = config.relics.find((r) => r.perLevel.clickMultiplier)!
  assert.ok(relicError(save.runState, save.metaState, config, relic.id), "closed at first")

  const meta = { ...save.metaState, rebirthCount: RELIC_UNLOCK_REBIRTHS }
  const cost = relicCost(meta, config, relic)
  assert.ok(cost > 0)
  assert.ok(buyRelic(save.runState, meta, config, relic.id).error, "no currency, no relic")

  const run = { ...save.runState, currentWorldLine: RELIC_UNLOCK_REBIRTHS + 1, regionCurrency: { [relic.regionId]: cost } }
  const bought = buyRelic(run, meta, config, relic.id)
  assert.equal(bought.error, undefined)
  assert.equal(relicLevel(bought.meta, relic.id), 1)
  assert.equal(bought.run.regionCurrency[relic.regionId], 0)
  assert.ok(relicCost(bought.meta, config, relic) > cost, "each level costs more")
  const rich = { ...bought.run, regionCurrency: { [relic.regionId]: Number.MAX_VALUE } }
  assert.ok(relicError(rich, bought.meta, config, relic.id), "one level per worldline from the fourth")
  assert.equal(relicError({ ...rich, currentWorldLine: RELIC_UNLOCK_REBIRTHS + 2 }, bought.meta, config, relic.id), undefined)

  const before = derivedClick(run, meta, config).click
  const after = derivedClick(run, bought.meta, config).click
  assert.ok(Math.abs(after / before - relic.perLevel.clickMultiplier!) < 1e-9)

  // Levels survive a save round-trip and are clamped to the cap.
  const reloaded = sanitizeSave({ ...save, metaState: { ...bought.meta, relicLevels: { [relic.id]: 99, bogus: 3 } } }, config, NOW)
  assert.deepEqual(reloaded.metaState.relicLevels, { [relic.id]: relic.maxLevel })
  const maxed = { ...meta, relicLevels: { [relic.id]: relic.maxLevel } }
  assert.ok(relicError({ ...run, regionCurrency: { [relic.regionId]: Number.MAX_VALUE } }, maxed, config, relic.id))
})

test("production relics lift production", () => {
  const save = createInitialSave(NOW, config)
  const relic = config.relics.find((r) => r.perLevel.productionMultiplier && !r.perLevel.clickMultiplier)!
  const run = { ...save.runState, producerLevels: { solar_node: 10 } }
  const base = productionSnapshot(run, save.metaState, config, NOW).perSecond
  const boosted = productionSnapshot(run, { ...save.metaState, relicLevels: { [relic.id]: 2 } }, config, NOW).perSecond
  assert.ok(boosted / base > relic.perLevel.productionMultiplier! ** 2 * 0.999)
})

test("old saves without relic levels load empty", () => {
  const legacy = createInitialSave(NOW, config) as unknown as { metaState: Record<string, unknown> }
  delete legacy.metaState.relicLevels
  const loaded = sanitizeSave(legacy, config, NOW)
  assert.deepEqual(loaded.metaState.relicLevels, {})
})
