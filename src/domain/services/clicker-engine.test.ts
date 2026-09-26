import assert from "node:assert/strict"
import test from "node:test"
import { clickerConfig } from "../../data/clicker/catalog.ts"
import {
  resumeAfterGap,
  applyRebirth,
  applyTrueEnding,
  buyActiveSkillItem,
  buyPotion,
  returnHomeRegion,
  travelToRegion,
  canTriggerTrueEnding,
  createInitialSave,
  buyProducer,
  buySkillNode,
  buyUpgrade,
  canRebirth,
  createInitialMeta,
  createInitialRun,
  enterClickerMine,
  grantAdminEnergy,
  maxAffordable,
  processClick,
  processTick,
  producerBulkCost,
  producerCost,
  rebirthRequirement,
  productionSnapshot,
  resolveCrisis,
  regionPresenceMultipliers,
  sanitizeSave,
  startClickerGame,
  startFever,
  syncClickerMineSession,
  activateSkill,
  markRegionVisited,
  claimRegionChallenge,
  regionChallengeError,
  MINE_HOME_ONLY_ERROR,
} from "./clicker-engine.ts"
import { MINE_SESSION_BASE_MS as MINE_SESSION_MS, mineSessionDurationMs } from "./clicker-engine.ts"
import { formatNumber } from "./clicker-format.ts"

const config = clickerConfig
const rng = () => 0.99
const critRng = () => 0.0

test("formatNumber uses a single suffix scale", () => {
  assert.equal(formatNumber(12.84), "12.84")
  assert.equal(formatNumber(1250), "1.25K")
  assert.equal(formatNumber(1_250_000), "1.25M")
  assert.equal(formatNumber(1_250_000_000), "1.25B")
})

test("producer cost follows base × growth^level and bulk uses the same rule", () => {
  const one = producerCost(config, "solar_node", 0)
  assert.equal(one, 600)
  const ten = producerBulkCost(config, "solar_node", 0, 10)
  let sum = 0
  for (let i = 0; i < 10; i++) sum += producerCost(config, "solar_node", i)
  assert.ok(Math.abs(ten - sum) < 1e-6)
  assert.equal(maxAffordable(config, "solar_node", 0, 599), 0)
  assert.equal(maxAffordable(config, "solar_node", 0, 600), 1)
  // Later worldlines price everything up by priceGrowth^rebirths.
  assert.equal(producerCost(config, "solar_node", 0, config.priceGrowth), 600 * config.priceGrowth)
})

test("click adds energy, combo expires by clock, critical uses rng", () => {
  const now = 1_000_000
  const run = createInitialRun(now, createInitialMeta(), config)
  const meta = createInitialMeta()
  const first = processClick(run, meta, config, now, rng)
  assert.ok(first.result.energyGained >= 1)
  assert.equal(first.result.isCritical, false)
  assert.equal(first.result.comboCount, 1)
  const second = processClick(first.run, first.meta, config, now + 200, rng)
  assert.equal(second.result.comboCount, 2)
  const expired = processClick(second.run, second.meta, config, now + 10_000, rng)
  assert.equal(expired.result.comboCount, 1)
  const crit = processClick(run, meta, config, now, critRng)
  assert.equal(crit.result.isCritical, true)
  assert.ok(crit.result.energyGained > first.result.energyGained)
})

test("buying a producer spends CORE and tick adds production", () => {
  const now = 2_000_000
  const meta = createInitialMeta()
  const run = grantAdminEnergy(createInitialRun(now, meta, config), 1_000)
  const bought = buyProducer(run, meta, config, "solar_node", 1)
  assert.equal(bought.error, undefined)
  assert.equal(bought.run.producerLevels.solar_node, 1)
  assert.ok(bought.run.coreEnergy < run.coreEnergy)
  const snap = productionSnapshot(bought.run, meta, config, now)
  assert.ok(snap.perSecond > 0)
  const ticked = processTick(bought.run, meta, config, now + 1000)
  assert.ok(ticked.run.coreEnergy > bought.run.coreEnergy)
})

test("fever starts from gauge or potion and ends after duration", () => {
  const now = 3_000_000
  const meta = createInitialMeta()
  let run = createInitialRun(now, meta, config)
  run = { ...run, fever: { ...run.fever, gauge: 100 } }
  const fromGauge = startFever(run, meta, config, "GAUGE", null)
  assert.equal(fromGauge.run.fever.phase, "FEVER")
  let later = { run: fromGauge.run, meta }
  for (let t = 1; t <= 25; t++) {
    later = processTick(later.run, later.meta, config, now + t * 1000)
  }
  assert.ok(later.run.fever.phase === "COOL_DOWN" || later.run.fever.phase === "IDLE")
  const stocked = { ...run, potions: { blue: 1 } }
  const potionStart = startFever(stocked, meta, config, "POTION", "blue")
  assert.equal(potionStart.run.fever.phase, "FEVER")
  assert.equal(potionStart.run.potions.blue, 0)
})

test("region travel unlocks at lifetime threshold and return home works", () => {
  const now = 11_000_000
  const meta = createInitialMeta()
  let run = createInitialRun(now, meta, config)
  const locked = travelToRegion(run, config, "signal_relay")
  assert.equal(locked.error, "아직 잠겨 있습니다.")
  run = grantAdminEnergy(run, 250_000)
  const travel = travelToRegion(run, config, "signal_relay")
  assert.equal(travel.error, undefined)
  assert.equal(travel.run.currentRegionId, "signal_relay")
  const home = returnHomeRegion(travel.run, config)
  assert.equal(home.error, undefined)
  assert.equal(home.run.currentRegionId, "core_chamber")
})

test("region location persists through sanitizeSave reload", () => {
  const now = 11_500_000
  const meta = createInitialMeta()
  let run = grantAdminEnergy(createInitialRun(now, meta, config), 250_000)
  run = travelToRegion(run, config, "signal_relay").run
  const save = {
    schemaVersion: config.schemaVersion,
    savedAt: now,
    settings: { muted: false, introSeen: true },
    metaState: meta,
    runState: run,
  }
  const loaded = sanitizeSave(save, config, now + 60_000)
  assert.equal(loaded.runState.currentRegionId, "signal_relay")
  assert.equal(loaded.settings.gameStarted, true)
})

test("startClickerGame leaves title for the hub surface", () => {
  const save = createInitialSave(1_000, config)
  assert.equal(save.settings.gameStarted, false)
  const started = startClickerGame(save)
  assert.equal(started.settings.gameStarted, true)
  assert.equal(started.settings.playSurface, "hub")
  assert.equal(startClickerGame(started), started)
})

test("sanitizeSave marks gameStarted for returning players", () => {
  const now = 12_000_000
  const meta = createInitialMeta()
  const run = grantAdminEnergy(createInitialRun(now, meta, config), 100)
  const loaded = sanitizeSave(
    {
      schemaVersion: config.schemaVersion,
      savedAt: now,
      settings: { muted: false },
      metaState: meta,
      runState: run,
    },
    config,
    now,
  )
  assert.equal(loaded.settings.gameStarted, true)
})

test("phase vault unlocks at 2M lifetime CORE", () => {
  const now = 11_200_000
  const meta = createInitialMeta()
  let run = createInitialRun(now, meta, config)
  const locked = travelToRegion(run, config, "phase_vault")
  assert.equal(locked.error, "아직 잠겨 있습니다.")
  run = grantAdminEnergy(run, 2_000_000)
  const travel = travelToRegion(run, config, "phase_vault")
  assert.equal(travel.error, undefined)
  assert.equal(travel.run.currentRegionId, "phase_vault")
})

test("region presence bonuses apply only while in that region", () => {
  const now = 13_000_000
  const meta = createInitialMeta()
  let run = grantAdminEnergy(createInitialRun(now, meta, config), 2_000_000)
  run = { ...run, producerLevels: { ...run.producerLevels, solar_node: 10 } }

  const chamber = regionPresenceMultipliers(run, config)
  assert.equal(chamber.click, 1.05)
  assert.equal(chamber.production, 1)

  const chamberClick = processClick(run, meta, config, now, rng)
  const chamberProd = productionSnapshot(run, meta, config, now).perSecond

  run = travelToRegion(run, config, "signal_relay").run
  const relay = regionPresenceMultipliers(run, config)
  assert.equal(relay.click, 1)
  assert.equal(relay.production, 1.12)
  const relayClick = processClick(run, meta, config, now + 1, rng)
  const relayProd = productionSnapshot(run, meta, config, now + 1).perSecond
  assert.ok(relayClick.result.energyGained < chamberClick.result.energyGained)
  assert.ok(relayProd > chamberProd)
  assert.ok(Math.abs(relayProd / chamberProd - 1.12) < 1e-9)

  run = travelToRegion(run, config, "phase_vault").run
  const vault = regionPresenceMultipliers(run, config)
  assert.equal(vault.click, 1.08)
  assert.equal(vault.production, 1.1)
  const vaultClick = processClick(run, meta, config, now + 2, rng)
  const vaultProd = productionSnapshot(run, meta, config, now + 2).perSecond
  assert.ok(vaultClick.result.energyGained > relayClick.result.energyGained)
  assert.ok(vaultClick.result.energyGained > chamberClick.result.energyGained)
  assert.ok(Math.abs(vaultProd / chamberProd - 1.1) < 1e-9)

  run = returnHomeRegion(run, config).run
  const home = regionPresenceMultipliers(run, config)
  assert.equal(home.click, 1.05)
  assert.equal(home.production, 1)
})

test("rebirth clears region bonuses back to Core Chamber", () => {
  const now = 13_500_000
  const meta = createInitialMeta()
  let run = grantAdminEnergy(createInitialRun(now, meta, config), config.rebirthEnergy)
  run = travelToRegion(run, config, "signal_relay").run
  assert.equal(regionPresenceMultipliers(run, config).production, 1.12)
  const reborn = applyRebirth(run, meta, config, "focus_line", now + 10)
  assert.equal(reborn.error, undefined)
  assert.equal(reborn.run.currentRegionId, "core_chamber")
  assert.equal(regionPresenceMultipliers(reborn.run, config).click, 1.05)
  assert.equal(regionPresenceMultipliers(reborn.run, config).production, 1)
})

test("rebirth resets region to home chamber", () => {
  const now = 12_500_000
  const meta = createInitialMeta()
  let run = grantAdminEnergy(createInitialRun(now, meta, config), config.rebirthEnergy)
  run = travelToRegion(run, config, "signal_relay").run
  const reborn = applyRebirth(run, meta, config, "focus_line", now + 10)
  assert.equal(reborn.error, undefined)
  assert.equal(reborn.run.currentRegionId, "core_chamber")
})

test("transcendence gate starts at 10M lifetime CORE and grows each worldline", () => {
  const now = 12_000_000
  const meta = createInitialMeta()
  let run = createInitialRun(now, meta, config)
  assert.equal(canRebirth(run, meta, config), false)
  run = grantAdminEnergy(run, 9_999_999)
  assert.equal(canRebirth(run, meta, config), false)
  run = grantAdminEnergy(run, 1)
  assert.equal(canRebirth(run, meta, config), true)
  const later = { ...meta, rebirthCount: 1 }
  assert.equal(canRebirth(run, later, config), false)
  assert.equal(rebirthRequirement(later, config), 10_000_000 * config.rebirthGrowth)
})

test("45min-to-10M balance knobs remain on tuned values", () => {
  assert.equal(config.baseClick, 6.5)
  assert.equal(config.rebirthEnergy, 10_000_000)
  assert.equal(config.producers[0]?.productionPerSecond, 1.5)
  assert.equal(config.producers.find((p) => p.id === "resonance_array")?.unlockAt, 10_000_000)
})

test("active skill shop purchase adds charges and use consumes one", () => {
  const now = 6_500_000
  const meta = createInitialMeta()
  const skill = config.activeSkills[0]
  const run = grantAdminEnergy(createInitialRun(now, meta, config), skill.shopCost + 100)
  const bought = buyActiveSkillItem(run, config, skill.id)
  assert.equal(bought.error, undefined)
  assert.equal(bought.run.skillItems[skill.id], 1)
  assert.ok(bought.run.coreEnergy < run.coreEnergy)
  const used = activateSkill(bought.run, meta, config, skill.id, now + 100)
  assert.equal(used.error, undefined)
  assert.equal(used.run.skillItems[skill.id], 0)
})

test("clicks do not drop potions and shop purchase adds inventory", () => {
  const now = 6_000_000
  const meta = createInitialMeta()
  let run = grantAdminEnergy(createInitialRun(now, meta, config), 2_000_000)
  for (let i = 0; i < 200; i++) {
    const click = processClick(run, meta, config, now + i * 50, () => 0.99)
    run = click.run
    assert.equal(Object.keys(run.potions).length, 0)
  }
  const bought = buyPotion(run, config, "blue")
  assert.equal(bought.error, undefined)
  assert.equal(bought.run.potions.blue, 1)
  assert.ok(bought.run.coreEnergy < run.coreEnergy)
  const poor = buyPotion({ ...bought.run, coreEnergy: 0 }, config, "blue")
  assert.equal(poor.error, "CORE가 부족합니다.")
})

test("instability clamps and crisis choices leave a finite value", () => {
  const now = 4_000_000
  const meta = createInitialMeta()
  let run = createInitialRun(now, meta, config)
  run = { ...run, instability: 100, crisisActive: true }
  const resolved = resolveCrisis(run, meta, config, "STABILIZE", now, rng)
  assert.equal(resolved.run.crisisActive, false)
  assert.ok(resolved.run.instability < 100)
  assert.ok(resolved.run.instability >= 0)
})

test("rebirth resets run and keeps transcendence on meta", () => {
  const now = 5_000_000
  const meta = createInitialMeta()
  const run = grantAdminEnergy(createInitialRun(now, meta, config), config.rebirthEnergy)
  const result = applyRebirth(run, meta, config, "focus_line", now + 10)
  assert.equal(result.error, undefined)
  assert.equal(result.meta.rebirthCount, 1)
  assert.deepEqual(result.meta.transcendenceIds, ["focus_line"])
  assert.equal(result.run.producerLevels.solar_node, 0)
  assert.ok(result.run.coreEnergy < config.rebirthEnergy)
})

test("time away earns nothing and lapses timed state", () => {
  const now = 6_000_000
  const meta = createInitialMeta()
  let run = grantAdminEnergy(createInitialRun(now, meta, config), 100)
  run = buyProducer(run, meta, config, "solar_node", 1).run
  run = { ...run, lastTickAt: now - 3_600_000, fever: { ...run.fever, phase: "FEVER", remainingTime: 10 } }
  const resumed = resumeAfterGap(run)
  assert.equal(resumed.coreEnergy, run.coreEnergy)
  assert.equal(resumed.lifetimeCoreEnergy, run.lifetimeCoreEnergy)
  assert.equal(resumed.fever.phase, "IDLE")
  assert.deepEqual(resumed.activeBuffs, [])
})

test("corrupted save falls back without throwing", () => {
  const save = sanitizeSave({ nope: true }, config, 7_000_000)
  assert.equal(save.schemaVersion, config.schemaVersion)
  assert.equal(save.runState.coreEnergy, 0)
})

test("owned skills persist through sanitizeSave reload", () => {
  const now = 8_500_000
  const meta = createInitialMeta()
  let run = grantAdminEnergy(createInitialRun(now, meta, config), 10_000)
  run = buySkillNode(run, config, "focus_click").run
  const save = {
    schemaVersion: config.schemaVersion,
    savedAt: now,
    settings: { muted: false },
    metaState: meta,
    runState: run,
  }
  const loaded = sanitizeSave(save, config, now + 60_000)
  assert.deepEqual(loaded.runState.ownedSkillNodeIds, ["focus_click"])
  assert.equal(loaded.settings.playSurface, "hub")
})

test("skill nodes cost CORE and focus_click boosts click gain", () => {
  const now = 9_000_000
  const meta = createInitialMeta()
  let run = grantAdminEnergy(createInitialRun(now, meta, config), 1_000_000)
  const cost = config.skillNodes.find((n) => n.id === "focus_click")!.cost
  const beforeEnergy = run.coreEnergy
  const beforeClick = processClick(run, meta, config, now, rng).result.energyGained
  const bought = buySkillNode(run, config, "focus_click")
  assert.equal(bought.error, undefined)
  run = bought.run
  assert.equal(run.coreEnergy, beforeEnergy - cost)
  assert.deepEqual(run.ownedSkillNodeIds, ["focus_click"])

  const afterClick = processClick(run, meta, config, now + 50, rng).result.energyGained
  assert.ok(afterClick > beforeClick * 1.2)

  const chained = buySkillNode(run, config, "focus_crit")
  assert.equal(chained.error, undefined)
})

test("Enter Mine starts a timed session from any UI locale", () => {
  const now = 11_000_000
  let save = startClickerGame(createInitialSave(now, config))
  assert.equal(save.settings.playSurface, "hub")
  const fromKo = enterClickerMine(save, now, config, "ko")
  assert.equal(fromKo.error, undefined)
  assert.equal(fromKo.save.settings.playSurface, "mine")
  save = fromKo.save
  assert.equal(save.runState.mineSessionDurationMs, MINE_SESSION_MS)
  assert.equal(save.runState.mineSessionEndsAt, now + MINE_SESSION_MS)
  const expired = syncClickerMineSession(save, now + MINE_SESSION_MS + 1)
  assert.equal(expired.settings.playSurface, "hub")
  assert.ok(expired.runState.mineCooldownUntil > now)
  const cooling = enterClickerMine(expired, now + MINE_SESSION_MS + 1, config)
  assert.ok(cooling.error)
})

test("the mine opens only in the home region", () => {
  const now = 11_200_000
  const save = startClickerGame(createInitialSave(now, config))
  const away = grantAdminEnergy(save.runState, 300_000)
  const traveled = { ...save, runState: travelToRegion(away, config, "signal_relay").run }
  const refused = enterClickerMine(traveled, now, config)
  assert.equal(refused.error, MINE_HOME_ONLY_ERROR)
  assert.equal(refused.save.settings.playSurface, "hub")
  const home = { ...traveled, runState: returnHomeRegion(traveled.runState, config).run }
  assert.equal(enterClickerMine(home, now, config).save.settings.playSurface, "mine")
})

test("field challenge pays production by score and then cools down", () => {
  const now = 12_000_000
  const meta = createInitialMeta()
  let run = grantAdminEnergy(createInitialRun(now, meta, config), 60_000_000)
  run = buyProducer(run, meta, config, "solar_node", 5).run
  const away = claimRegionChallenge(run, meta, config, "storm_spire", 1, now)
  assert.ok(away.error, "must stand in the region")
  run = travelToRegion(run, config, "storm_spire").run
  const perSecond = productionSnapshot(run, meta, config, now).perSecond
  const spire = config.regions.find((r) => r.id === "storm_spire")!.challenge!
  const half = claimRegionChallenge(run, meta, config, "storm_spire", 0.5, now)
  assert.equal(half.error, undefined)
  assert.ok(Math.abs(half.reward - perSecond * spire.rewardSeconds * 0.5) < 1e-6)
  assert.ok(Math.abs(half.run.coreEnergy - run.coreEnergy - half.reward) < 1e-6)
  assert.ok(regionChallengeError(half.run, config, "storm_spire", now + 1000))
  assert.equal(regionChallengeError(half.run, config, "storm_spire", now + spire.cooldownSec * 1000), undefined)
  const cheat = claimRegionChallenge(run, meta, config, "storm_spire", 7, now)
  assert.ok(Math.abs(cheat.reward - perSecond * spire.rewardSeconds) < 1e-6, "score is clamped to 1")
  assert.ok(claimRegionChallenge(run, meta, config, "signal_relay", 1, now).error, "relay has no challenge")
})

test("region visits are recorded once so only the first entry counts as new", () => {
  const meta = createInitialMeta()
  const first = markRegionVisited(meta, "signal_relay")
  assert.equal(first.firstVisit, true)
  const again = markRegionVisited(first.meta, "signal_relay")
  assert.equal(again.firstVisit, false)
  assert.deepEqual(again.meta.visitedRegionIds, ["signal_relay"])
  const legacy = sanitizeSave({ ...createInitialSave(1, config), metaState: { ...meta, visitedRegionIds: undefined } }, config, 1)
  assert.deepEqual(legacy.metaState.visitedRegionIds, [])
})

test("broke re-entry is free without producers, charged once producers exist", () => {
  const now = 11_500_000
  const start = startClickerGame(createInitialSave(now, config))
  // Past a cooldown, zero CORE — the state a player lands in after an idle mine run.
  const broke = {
    ...start,
    runState: { ...start.runState, coreEnergy: 0, mineCooldownUntil: now - 1 },
  }
  const free = enterClickerMine(broke, now, config, "ko")
  assert.equal(free.error, undefined)
  assert.equal(free.save.settings.playSurface, "mine")

  const firstProducer = config.producers[0]!.id
  const withProducer = {
    ...broke,
    runState: { ...broke.runState, producerLevels: { ...broke.runState.producerLevels, [firstProducer]: 1 } },
  }
  assert.ok(enterClickerMine(withProducer, now, config, "ko").error)
})

test("mine session length grows from skill-tree dwell nodes", () => {
  const now = 12_000_000
  let save = startClickerGame(createInitialSave(now, config))
  save = {
    ...save,
    runState: grantAdminEnergy(save.runState, 200_000),
  }
  let run = buySkillNode(save.runState, config, "focus_click").run
  run = buySkillNode(run, config, "mine_dwell").run
  run = buySkillNode(run, config, "mine_extend").run
  save = { ...save, runState: run }
  assert.equal(mineSessionDurationMs(run, config), MINE_SESSION_MS + 15_000)
  const entered = enterClickerMine(save, now, config, "ko")
  assert.equal(entered.error, undefined)
  assert.equal(entered.save.runState.mineSessionDurationMs, MINE_SESSION_MS + 15_000)
  assert.equal(entered.save.runState.mineSessionEndsAt, now + MINE_SESSION_MS + 15_000)
})

test("true ending unlocks when all transcendence buffs were chosen once", () => {
  const now = 10_000_000
  let save = createInitialSave(now, config)
  assert.equal(canTriggerTrueEnding(save.metaState, config), false)
  for (const buff of config.transcendence) {
    save = {
      ...save,
      runState: grantAdminEnergy(save.runState, rebirthRequirement(save.metaState, config)),
      metaState: save.metaState,
    }
    const result = applyRebirth(save.runState, save.metaState, config, buff.id, now + buff.id.length)
    save = { ...save, runState: result.run, metaState: result.meta }
  }
  assert.equal(canTriggerTrueEnding(save.metaState, config), true)
  const completed = applyTrueEnding(save, config, now + 99)
  assert.equal(completed.error, undefined)
  assert.equal(completed.save.metaState.gameCompleted, true)
  assert.ok(completed.save.metaState.completedAt)
  const again = applyTrueEnding(completed.save, config, now + 100)
  assert.equal(again.error, "이미 완료된 기록입니다.")
})

test("upgrade purchase is rejected when CORE is short or already owned", () => {
  const now = 8_000_000
  const meta = createInitialMeta()
  const run = createInitialRun(now, meta, config)
  const poor = buyUpgrade(run, config, "reinforced_input")
  assert.equal(poor.error, "CORE가 부족합니다.")
  const rich = buyUpgrade(grantAdminEnergy(run, 10_000), config, "reinforced_input")
  assert.equal(rich.error, undefined)
  const again = buyUpgrade(rich.run, config, "reinforced_input")
  assert.equal(again.error, "이미 보유함")
})
