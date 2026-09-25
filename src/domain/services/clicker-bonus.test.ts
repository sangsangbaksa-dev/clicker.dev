import assert from "node:assert/strict"
import test from "node:test"
import { clickerConfig as config } from "../../data/clicker/catalog.ts"
import {
  ACHIEVEMENT_PRODUCTION_BONUS,
  DRILL_OVERDRIVE_COOLDOWN_MS,
  DRILL_OVERDRIVE_MULTIPLIER,
  VEIN_JACKPOT,
  VEIN_LASER_RUSH,
  VEIN_SURGE,
  autoDrillRate,
  awardAchievements,
  claimGoldenVein,
  jackpotEnergy,
  rollVeinKind,
  startDrillOverdrive,
} from "./clicker-bonus.ts"
import {
  createInitialSave,
  grantAdminEnergy,
  processClick,
  processTick,
  productionSnapshot,
  sanitizeSave,
} from "./clicker-engine.ts"

const NOW = 20_000_000

function withProducer(level = 5) {
  const save = createInitialSave(NOW, config)
  const first = config.producers[0]!.id
  return {
    ...save,
    runState: { ...save.runState, producerLevels: { ...save.runState.producerLevels, [first]: level } },
  }
}

test("vein roll splits 45 / 45 / 10", () => {
  assert.equal(rollVeinKind(() => 0.1), "surge")
  assert.equal(rollVeinKind(() => 0.5), "jackpot")
  assert.equal(rollVeinKind(() => 0.95), "laser_rush")
})

test("jackpot pays the smaller of bank share and production minutes, plus a floor", () => {
  assert.equal(jackpotEnergy(0, 0), VEIN_JACKPOT.floor)
  assert.equal(jackpotEnergy(1_000_000, 1), 1 * VEIN_JACKPOT.productionSeconds + VEIN_JACKPOT.floor)
  assert.equal(jackpotEnergy(1_000, 1_000), 1_000 * VEIN_JACKPOT.bankShare + VEIN_JACKPOT.floor)
})

test("surge vein multiplies production until it expires", () => {
  const save = withProducer()
  const base = productionSnapshot(save.runState, save.metaState, config, NOW).perSecond
  const claimed = claimGoldenVein(save.runState, save.metaState, base, NOW, () => 0.1)
  assert.equal(claimed.outcome.kind, "surge")
  assert.equal(claimed.meta.statistics.veins, 1)
  const boosted = productionSnapshot(claimed.run, claimed.meta, config, NOW + 1).perSecond
  assert.ok(Math.abs(boosted - base * VEIN_SURGE.multiplier) < 1e-9)
  const after = productionSnapshot(claimed.run, claimed.meta, config, NOW + VEIN_SURGE.seconds * 1000 + 1).perSecond
  assert.ok(Math.abs(after - base) < 1e-9)
  // Tick prunes the expired boost.
  const ticked = processTick(
    { ...claimed.run, lastTickAt: NOW + VEIN_SURGE.seconds * 1000 },
    claimed.meta,
    config,
    NOW + VEIN_SURGE.seconds * 1000 + 500,
  )
  assert.equal(ticked.run.eventBoosts.length, 0)
})

test("laser rush multiplies click energy", () => {
  const save = createInitialSave(NOW, config)
  const noCrit = () => 0.99
  const plain = processClick(save.runState, save.metaState, config, NOW, noCrit).result.energyGained
  const claimed = claimGoldenVein(save.runState, save.metaState, 0, NOW, () => 0.95)
  const rushed = processClick(claimed.run, claimed.meta, config, NOW, noCrit).result.energyGained
  assert.ok(Math.abs(rushed - plain * VEIN_LASER_RUSH.multiplier) < 1e-9)
})

test("jackpot vein grants CORE and counts toward lifetime", () => {
  const save = createInitialSave(NOW, config)
  const claimed = claimGoldenVein(save.runState, save.metaState, 0, NOW, () => 0.5)
  assert.equal(claimed.outcome.kind, "jackpot")
  assert.equal(claimed.run.coreEnergy, save.runState.coreEnergy + VEIN_JACKPOT.floor)
  assert.equal(claimed.run.lifetimeCoreEnergy, save.runState.lifetimeCoreEnergy + VEIN_JACKPOT.floor)
})

test("achievements unlock once and add production", () => {
  const save = withProducer(10)
  const base = productionSnapshot(save.runState, save.metaState, config, NOW).perSecond
  const first = awardAchievements(save.runState, save.metaState, config.achievements)
  assert.ok(first.unlocked.some((a) => a.id === "prod_10"))
  const again = awardAchievements(save.runState, first.meta, config.achievements)
  assert.equal(again.unlocked.length, 0)
  const boosted = productionSnapshot(save.runState, first.meta, config, NOW).perSecond
  const expected = base * (1 + first.meta.achievementIds.length * ACHIEVEMENT_PRODUCTION_BONUS)
  assert.ok(Math.abs(boosted - expected) < 1e-9)
})

test("auto-drill needs its skill; overdrive triples rate then cools down", () => {
  const save = createInitialSave(NOW, config)
  assert.equal(autoDrillRate(save.runState, config, NOW), 0)
  assert.ok(startDrillOverdrive(save.runState, config, NOW).error)

  const run = { ...grantAdminEnergy(save.runState, 0), ownedSkillNodeIds: ["auto_prod", "auto_more", "auto_drill"] }
  const base = autoDrillRate(run, config, NOW)
  assert.equal(base, 2)
  const over = startDrillOverdrive(run, config, NOW)
  assert.equal(over.error, undefined)
  assert.equal(autoDrillRate(over.run, config, NOW + 1), base * DRILL_OVERDRIVE_MULTIPLIER)
  assert.ok(startDrillOverdrive(over.run, config, NOW + 60_000).error)
  assert.equal(startDrillOverdrive(over.run, config, NOW + DRILL_OVERDRIVE_COOLDOWN_MS).error, undefined)
})

test("old saves without the new fields load with safe defaults", () => {
  const legacy = createInitialSave(NOW, config) as unknown as Record<string, Record<string, unknown>>
  delete legacy.runState!.eventBoosts
  delete legacy.runState!.drillOverdriveUntil
  delete legacy.metaState!.achievementIds
  legacy.metaState!.statistics = { clicks: 3, crits: 0, maxCombo: 1, feverStarts: 0 }
  const loaded = sanitizeSave(legacy, config, NOW)
  assert.deepEqual(loaded.runState.eventBoosts, [])
  assert.equal(loaded.runState.drillOverdriveUntil, 0)
  assert.deepEqual(loaded.metaState.achievementIds, [])
  assert.equal(loaded.metaState.statistics.veins, 0)
  assert.equal(loaded.metaState.statistics.clicks, 3)
})
