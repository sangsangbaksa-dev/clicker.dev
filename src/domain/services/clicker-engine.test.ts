import assert from "node:assert/strict"
import test from "node:test"
import { clickerConfig } from "../../data/clicker/catalog.ts"
import type { RunState } from "../entities/clicker.ts"
import {
  monsterAlive,
  slayMonster,
  startBossFight,
  strikeBoss,
  tickBoss,
  resumeAfterGap,
  applyRebirth,
  applyTrueEnding,
  buyActiveSkillItem,
  activeSkillCost,
  ACTIVE_SKILL_PRICE_MULT,
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
  mineYieldMultiplier,
  reentryCooldownMs,
  regionUnlockThreshold,
  buffMultiplier,
  markRegionVisited,
  claimRegionChallenge,
  regionChallengeError,
  MINE_HOME_ONLY_ERROR,
} from "./clicker-engine.ts"
import { MINE_SESSION_BASE_MS as MINE_SESSION_MS, buffCritChance, derivedClick, mineSessionDurationMs, worldlineGoal } from "./clicker-engine.ts"
import { formatNumber } from "./clicker-format.ts"

const config = clickerConfig
/** Lifetime CORE that opens a world in the first worldline. */
const worldCore = (id: string) =>
  regionUnlockThreshold(createInitialRun(0, createInitialMeta(), config), config, config.regions.find((r) => r.id === id)!)
/** Lifetime CORE that ends the first worldline (goal table applied). */
const firstGoal = worldlineGoal(config, 0)
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
  assert.equal(one, 0.3)
  const ten = producerBulkCost(config, "solar_node", 0, 10)
  let sum = 0
  for (let i = 0; i < 10; i++) sum += producerCost(config, "solar_node", i)
  assert.ok(Math.abs(ten - sum) < 1e-6)
  assert.equal(maxAffordable(config, "solar_node", 0, 0.29), 0)
  assert.equal(maxAffordable(config, "solar_node", 0, 0.3), 1)
  // Later worldlines price everything up by priceGrowth^rebirths.
  assert.equal(producerCost(config, "solar_node", 0, config.priceGrowth), 0.3 * config.priceGrowth)
})

test("click adds energy, combo expires by clock, critical uses rng", () => {
  const now = 1_000_000
  const run = createInitialRun(now, createInitialMeta(), config)
  const meta = createInitialMeta()
  const first = processClick(run, meta, config, now, rng)
  assert.ok(first.result.energyGained > 0)
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
  run = { ...run, fever: { ...run.fever, gauge: config.feverGaugeMax } }
  // Locked until the Fever Core circuit is owned.
  assert.match(startFever(run, meta, config, "GAUGE", null).error ?? "", /해금/)
  run = { ...run, ownedSkillNodeIds: ["focus_click", "fever_unlock"] }
  const fromGauge = startFever(run, meta, config, "GAUGE", null)
  assert.equal(fromGauge.run.fever.phase, "FEVER")
  // FEVER only counts down inside a mine session.
  let later = { run: { ...fromGauge.run, mineSessionEndsAt: now + 60_000 }, meta }
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
  run = grantAdminEnergy(run, worldCore("signal_relay"))
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
  let run = grantAdminEnergy(createInitialRun(now, meta, config), worldCore("signal_relay"))
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

test("phase vault unlocks at its lifetime CORE threshold", () => {
  const now = 11_200_000
  const meta = createInitialMeta()
  let run = createInitialRun(now, meta, config)
  const locked = travelToRegion(run, config, "phase_vault")
  assert.equal(locked.error, "아직 잠겨 있습니다.")
  run = grantAdminEnergy(run, worldCore("phase_vault"))
  const travel = travelToRegion(run, config, "phase_vault")
  assert.equal(travel.error, undefined)
  assert.equal(travel.run.currentRegionId, "phase_vault")
})

test("region presence bonuses apply only while in that region", () => {
  const now = 13_000_000
  const meta = createInitialMeta()
  let run = grantAdminEnergy(createInitialRun(now, meta, config), worldCore("phase_vault"))
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
  let run = grantAdminEnergy(createInitialRun(now, meta, config), firstGoal)
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
  let run = grantAdminEnergy(createInitialRun(now, meta, config), firstGoal)
  run = travelToRegion(run, config, "signal_relay").run
  const reborn = applyRebirth(run, meta, config, "focus_line", now + 10)
  assert.equal(reborn.error, undefined)
  assert.equal(reborn.run.currentRegionId, "core_chamber")
})

test("rebirth gate starts at rebirthEnergy lifetime CORE and grows each worldline", () => {
  const now = 12_000_000
  const meta = createInitialMeta()
  let run = createInitialRun(now, meta, config)
  assert.equal(canRebirth(run, meta, config), false)
  run = grantAdminEnergy(run, firstGoal * 0.999)
  assert.equal(canRebirth(run, meta, config), false)
  run = grantAdminEnergy(run, firstGoal * 0.001)
  assert.equal(canRebirth(run, meta, config), true)
  const later = { ...meta, rebirthCount: 1 }
  assert.equal(canRebirth(run, later, config), false)
  assert.equal(rebirthRequirement(later, config), worldlineGoal(config, 1))
  // Every worldline buff walked once: no more rebirths, Core Heart instead.
  const done = { ...meta, transcendenceIds: config.transcendence.map((t) => t.id) }
  assert.equal(canRebirth(grantAdminEnergy(run, 1e30), done, config), false)
})

test("economy is in the ÷1000 unit and rebirths are worth ×2, the same as the price rise", () => {
  assert.ok(Math.abs(config.baseClick - 0.0065) < 1e-12)
  assert.equal(config.rebirthEnergy, 1e9)
  assert.equal(config.producers[0]?.productionPerSecond, 0.003, "producers run at twice the earlier base output")
  assert.equal(config.worldlineBonus, 1)
  assert.equal(1 + config.worldlineBonus, config.priceGrowth)
  // Same tech, cheapest first.
  const costs = config.producers.map((p) => p.baseCost)
  assert.deepEqual(costs, [...costs].sort((a, b) => a - b))
})

test("active skill shop purchase adds charges and use consumes one", () => {
  const now = 6_500_000
  const meta = createInitialMeta()
  const skill = config.activeSkills[0]
  const run = grantAdminEnergy(createInitialRun(now, meta, config), skill.shopCost * ACTIVE_SKILL_PRICE_MULT + 100)
  const bought = buyActiveSkillItem(run, config, skill.id)
  assert.equal(bought.error, undefined)
  assert.equal(bought.run.skillItems[skill.id], 1)
  assert.ok(bought.run.coreEnergy < run.coreEnergy)
  assert.ok(activateSkill(bought.run, meta, config, skill.id, now + 100).error, "outside the mine skills cannot be cast")
  const inMine = { ...bought.run, mineSessionEndsAt: now + 60_000 }
  const used = activateSkill(inMine, meta, config, skill.id, now + 100)
  assert.equal(used.error, undefined)
  assert.equal(used.run.skillItems[skill.id], 0)
})

test("active skill prices keep pace with the run", () => {
  const meta = createInitialMeta()
  const run = createInitialRun(1, meta, config)
  const skill = config.activeSkills[0]
  assert.equal(activeSkillCost(run, skill), Math.ceil(skill.shopCost * ACTIVE_SKILL_PRICE_MULT))
  const rich = { ...run, lifetimeCoreEnergy: 1e12 }
  assert.ok(activeSkillCost(rich, skill) >= 1e12 * 0.01, "a share of this run's CORE")
  const pricier = config.activeSkills[config.activeSkills.length - 1]
  assert.ok(activeSkillCost(rich, pricier) > activeSkillCost(rich, skill))
})

test("active skill cooldowns and buffs only run inside the mine", () => {
  const now = 6_600_000
  const meta = createInitialMeta()
  const skill = config.activeSkills.find((s) => s.duration > 0 && s.clickMultiplier)!
  let run = grantAdminEnergy(createInitialRun(now, meta, config), skill.shopCost * ACTIVE_SKILL_PRICE_MULT + 100)
  run = buyActiveSkillItem(run, config, skill.id).run
  run = activateSkill({ ...run, mineSessionEndsAt: now + 60_000 }, meta, config, skill.id, now).run
  const expiresAt = run.activeBuffs[0].expiresAt
  // Leave the mine and let 30 seconds pass.
  let away: RunState = { ...run, mineSessionEndsAt: 0, lastTickAt: now }
  for (let t = 1; t <= 30; t++) away = processTick(away, meta, config, now + t * 1000).run
  assert.equal(away.skillCooldowns[skill.id], skill.cooldown)
  assert.equal(away.activeBuffs[0].expiresAt, expiresAt + 30_000)
  assert.equal(buffMultiplier(away, now + 30_000, "clickMultiplier", config), 1)
  // Back in the mine the clock resumes and the buff applies.
  const back = processTick({ ...away, mineSessionEndsAt: now + 120_000 }, meta, config, now + 31_000).run
  assert.ok(back.skillCooldowns[skill.id] < skill.cooldown)
  assert.equal(buffMultiplier(back, now + 31_000, "clickMultiplier", config), skill.clickMultiplier)
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
  const run = grantAdminEnergy(createInitialRun(now, meta, config), firstGoal)
  const result = applyRebirth(run, meta, config, "focus_line", now + 10)
  assert.equal(result.error, undefined)
  assert.equal(result.meta.rebirthCount, 1)
  assert.deepEqual(result.meta.transcendenceIds, ["focus_line"])
  assert.equal(result.run.producerLevels.solar_node, 0)
  assert.ok(result.run.coreEnergy < firstGoal)
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
  const away = grantAdminEnergy(save.runState, worldCore("signal_relay"))
  const traveled = { ...save, runState: travelToRegion(away, config, "signal_relay").run }
  const refused = enterClickerMine(traveled, now, config)
  assert.equal(refused.error, MINE_HOME_ONLY_ERROR)
  assert.equal(refused.save.settings.playSurface, "hub")
  const home = { ...traveled, runState: returnHomeRegion(traveled.runState, config).run }
  assert.equal(enterClickerMine(home, now, config).save.settings.playSurface, "mine")
})

test("Enter Mine waits until a crisis is resolved", () => {
  const now = 11_300_000
  const save = startClickerGame(createInitialSave(now, config))
  const inCrisis = { ...save, runState: { ...save.runState, crisisActive: true } }
  const refused = enterClickerMine(inCrisis, now, config)
  assert.ok(refused.error)
  assert.equal(refused.save.settings.playSurface, "hub")
  assert.equal(refused.save.runState.mineCooldownUntil, save.runState.mineCooldownUntil)
  const calm = { ...inCrisis, runState: { ...inCrisis.runState, crisisActive: false } }
  assert.equal(enterClickerMine(calm, now, config).save.settings.playSurface, "mine")
})

test("field challenge pays production by score and then cools down", () => {
  const now = 12_000_000
  const meta = createInitialMeta()
  let run = grantAdminEnergy(createInitialRun(now, meta, config), worldCore("storm_spire"))
  run = buyProducer(run, meta, config, "solar_node", 5).run
  const away = claimRegionChallenge(run, meta, config, "storm_spire", 1, now)
  assert.ok(away.error, "must stand in the region")
  run = travelToRegion(run, config, "storm_spire").run
  const perSecond = productionSnapshot(run, meta, config, now).perSecond
  const spire = config.regions.find((r) => r.id === "storm_spire")!.challenge!
  const half = claimRegionChallenge(run, meta, config, "storm_spire", 0.5, now)
  assert.equal(half.error, undefined)
  assert.ok(Math.abs(half.reward - perSecond * spire.rewardSeconds * 0.5) < 1e-6)
  assert.ok(Math.abs(half.run.coreEnergy - run.coreEnergy - half.reward) <= Math.max(1e-6, run.coreEnergy * 1e-12))
  assert.ok(regionChallengeError(half.run, config, "storm_spire", now + 1000))
  assert.equal(regionChallengeError(half.run, config, "storm_spire", now + spire.cooldownSec * 1000), undefined)
  const cheat = claimRegionChallenge(run, meta, config, "storm_spire", 7, now)
  assert.ok(Math.abs(cheat.reward - perSecond * spire.rewardSeconds) < 1e-6, "score is clamped to 1")
  assert.ok(claimRegionChallenge(run, meta, config, "signal_relay", 1, now).error, "relay has no challenge")
})

test("region visits are recorded once so the intro plays only on the first entry", () => {
  const meta = createInitialMeta()
  const first = markRegionVisited(meta, "signal_relay")
  assert.equal(first.firstVisit, true)
  const again = markRegionVisited(first.meta, "signal_relay")
  assert.equal(again.firstVisit, false)
  assert.deepEqual(again.meta.visitedRegionIds, ["signal_relay"])
  const legacy = sanitizeSave({ ...createInitialSave(1, config), metaState: { ...meta, visitedRegionIds: undefined } }, config, 1)
  assert.deepEqual(legacy.metaState.visitedRegionIds, [])
})

test("mine entry is free; only the re-enter cooldown applies", () => {
  const now = 11_500_000
  const start = startClickerGame(createInitialSave(now, config))
  const firstProducer = config.producers[0]!.id
  const broke = {
    ...start,
    runState: { ...start.runState, coreEnergy: 0, mineCooldownUntil: now - 1, producerLevels: { ...start.runState.producerLevels, [firstProducer]: 1 } },
  }
  const free = enterClickerMine(broke, now, config)
  assert.equal(free.error, undefined)
  assert.equal(free.save.runState.coreEnergy, 0)
  const cooling = { ...broke, runState: { ...broke.runState, mineCooldownUntil: now + 5_000 } }
  assert.ok(enterClickerMine(cooling, now, config).error)
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
  save = { ...save, runState: run }
  assert.equal(mineSessionDurationMs(run, config), MINE_SESSION_MS + 5_000)
  const entered = enterClickerMine(save, now, config, "ko")
  assert.equal(entered.error, undefined)
  assert.equal(entered.save.runState.mineSessionDurationMs, MINE_SESSION_MS + 5_000)
  assert.equal(entered.save.runState.mineSessionEndsAt, now + MINE_SESSION_MS + 5_000)
})

test("only three circuits extend the mine session, +30s in all", () => {
  const timed = config.skillNodes.filter((n) => (n.mineSessionSecondsAdd ?? 0) > 0)
  assert.deepEqual(timed.map((n) => n.id).sort(), ["mine_deepcut", "mine_dwell", "mine_endless"])
  assert.equal(timed.reduce((sum, n) => sum + n.mineSessionSecondsAdd!, 0), 30)
})

test("a save owning the former mine-time circuits loads with their new effects", () => {
  const now = 12_500_000
  const former = ["focus_click", "mine_dwell", "mine_quick", "mine_extend", "mine_marathon", "trans_start", "trans_mine"]
  const base = startClickerGame(createInitialSave(now, config))
  const raw = JSON.parse(JSON.stringify({ ...base, runState: { ...base.runState, ownedSkillNodeIds: former } }))
  const loaded = sanitizeSave(raw, config, now)
  assert.deepEqual(loaded.runState.ownedSkillNodeIds, former)
  assert.equal(mineSessionDurationMs(loaded.runState, config), MINE_SESSION_MS + 5_000)
  for (const id of ["mine_quick", "mine_extend", "mine_marathon", "trans_mine"]) {
    const node = config.skillNodes.find((n) => n.id === id)!
    assert.equal(node.mineSessionSecondsAdd, undefined, id)
    assert.ok(node.clickMultiplier || node.lightningChanceAdd || node.criticalMultiplier || node.productionMultiplier, id)
  }
})

test("true ending unlocks once the Core Heart guardian falls", () => {
  const now = 10_000_000
  let save = createInitialSave(now, config)
  assert.equal(canTriggerTrueEnding(save.metaState, config), false)
  for (const buff of config.transcendence) {
    save = { ...save, runState: grantAdminEnergy(save.runState, rebirthRequirement(save.metaState, config)) }
    const result = applyRebirth(save.runState, save.metaState, config, buff.id, now + buff.id.length)
    assert.equal(result.error, undefined)
    save = { ...save, runState: result.run, metaState: result.meta }
  }
  assert.equal(canTriggerTrueEnding(save.metaState, config), false)
  const heart = config.regions.find((r) => r.boss)!
  let run = grantAdminEnergy(save.runState, 1e40)
  run = travelToRegion(run, config, heart.id).run
  assert.equal(run.currentRegionId, heart.id)
  run = startBossFight(run, config, now).run
  assert.ok(run.boss)
  // Guardian swings on its timer.
  const hurt = tickBoss(run, config, now + heart.boss!.attackEverySec * 1000)
  assert.equal(hurt.boss!.playerHp, heart.boss!.playerHp - heart.boss!.attackDamage)
  // Timeout ends the fight without a win.
  assert.equal(tickBoss(run, config, now + heart.boss!.timeLimitSec * 1000).boss, null)
  const strong = { ...run, boss: { ...run.boss!, hp: 1e-9 } }
  const hit = strikeBoss(strong, save.metaState, config, now + 100, () => 0.5)
  assert.equal(hit.defeated, true)
  assert.equal(hit.run.boss, null)
  save = { ...save, runState: hit.run, metaState: hit.meta }
  assert.equal(canTriggerTrueEnding(save.metaState, config), true)
  const completed = applyTrueEnding(save, config, now + 99)
  assert.equal(completed.error, undefined)
  assert.equal(completed.save.metaState.gameCompleted, true)
  const again = applyTrueEnding(completed.save, config, now + 100)
  assert.equal(again.error, "이미 완료된 기록입니다.")
})

test("region monsters die on tap, pay CORE and respawn after 30s", () => {
  const now = 20_000_000
  const meta = createInitialMeta()
  const start = createInitialRun(now, meta, config)
  assert.equal(config.regions.find((r) => r.id === start.currentRegionId)?.monster, undefined, "home has no monster")
  const home = "phase_vault"
  const run = { ...start, currentRegionId: home }
  assert.equal(monsterAlive(run, home, now), true)
  const slain = slayMonster(run, meta, config, home, now)
  assert.equal(slain.error, undefined)
  assert.ok(slain.reward > 0)
  assert.equal(monsterAlive(slain.run, home, now + 29_000), false)
  assert.equal(monsterAlive(slain.run, home, now + 30_000), true)
  assert.ok(slayMonster(slain.run, slain.meta, config, home, now + 1_000).error)
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

test("region currency: a trickle where you stand, raised only by that world's tree", async () => {
  const eng = await import("./clicker-engine.ts")
  const config = clickerConfig
  const rate = config.regionCurrencyRate!
  assert.ok(rate > 0 && rate < 0.1, "worlds start by minting only a small share")
  const run0 = eng.createInitialRun(0, eng.createInitialMeta(), config)
  const away = { ...run0, currentRegionId: "signal_relay" }
  const earned = eng.accrueRegionCurrency(away, { ...away, lifetimeCoreEnergy: away.lifetimeCoreEnergy + 1000 }, config)
  assert.equal(eng.regionCurrencyBalance(earned, "signal_relay"), 1000 * rate)
  const home = eng.accrueRegionCurrency(run0, { ...run0, lifetimeCoreEnergy: run0.lifetimeCoreEnergy + 1000 }, config)
  assert.equal(eng.regionCurrencyBalance(home, "signal_relay"), 0)

  // CORE purchases no longer charge world currency.
  const late = [...config.upgrades].sort((a, b) => b.cost - a.cost)[0]
  assert.equal(eng.upgradeCurrencyCosts(run0, config, late).length, 0)
  const node = [...config.skillNodes].sort((a, b) => b.cost - a.cost)[0]
  assert.equal(eng.purchaseCurrencyCosts(run0, config, node.cost).length, 0)
})

test("world skill trees: one per world, bought in order with that world's currency only", async () => {
  const eng = await import("./clicker-engine.ts")
  const config = clickerConfig
  const worlds = config.regions.filter((r) => r.currency && !r.isHome)
  for (const w of worlds) assert.equal(eng.worldTreeNodes(config, w.id).length, 5, `${w.id} has a tree`)
  const open = {
    ...eng.createInitialRun(0, eng.createInitialMeta(), config),
    lifetimeCoreEnergy: eng.regionUnlockThreshold(eng.createInitialRun(0, eng.createInitialMeta(), config), config, worlds[0]),
  }
  const [first, second] = eng.worldTreeNodes(config, "signal_relay")
  const cost = eng.worldTreeNodeCost(open, config, first)
  assert.match(eng.worldTreeNodeError(open, config, first.id) ?? "", /부족/)
  // Another world's currency does not pay for this tree.
  assert.match(eng.worldTreeNodeError({ ...open, regionCurrency: { phase_vault: cost * 100 } }, config, first.id) ?? "", /부족/)
  assert.match(eng.worldTreeNodeError({ ...open, regionCurrency: { signal_relay: cost * 100 } }, config, second.id) ?? "", /먼저/)
  const bought = eng.buyWorldTreeNode({ ...open, regionCurrency: { signal_relay: cost } }, config, first.id)
  assert.equal(bought.error, undefined)
  assert.equal(eng.regionCurrencyBalance(bought.run, "signal_relay"), 0)
  // Its effect (×3 mint) applies to Signal Relay only.
  const there = { ...bought.run, currentRegionId: "signal_relay" }
  const minted = eng.accrueRegionCurrency(there, { ...there, lifetimeCoreEnergy: there.lifetimeCoreEnergy + 1000 }, config)
  assert.equal(eng.regionCurrencyBalance(minted, "signal_relay"), 1000 * config.regionCurrencyRate! * 3)
  assert.equal(eng.regionCurrencyRate(bought.run, config, "phase_vault"), config.regionCurrencyRate)
  // Locked worlds cannot be bought into.
  const locked = eng.worldTreeNodes(config, "deep_fault")[0]
  assert.match(eng.worldTreeNodeError({ ...open, regionCurrency: { deep_fault: 1e30 } }, config, locked.id) ?? "", /열리지/)
  // Core Heart has no currency and no tree.
  assert.equal(config.regions.find((r) => r.id === "core_heart")?.currency, undefined)
  assert.equal(eng.worldTreeNodes(config, "core_heart").length, 0)
})

test("lair: enter, get knocked out → 3-minute shield; forge gear; kill pays out", async () => {
  const eng = await import("./clicker-engine.ts")
  const lair = await import("./clicker-lair.ts")
  const config = clickerConfig
  const meta = eng.createInitialMeta()
  const base = { ...eng.createInitialRun(0, meta, config), currentRegionId: "phase_vault" }

  const entered = lair.enterLair(base, config, 1000)
  assert.equal(entered.error, undefined)
  assert.equal(entered.run.lair?.playerHp, lair.BASE_PLAYER_HP)

  // Nobody strikes back: the boss swings until the player drops, then shields.
  const t = 1000 + lair.LAIR_ATTACK_EVERY_MS * 20
  const beaten = lair.tickLair(entered.run, config, t)
  assert.equal(beaten.lair, null)
  assert.equal(lair.shieldRemainingMs(beaten, "phase_vault", t), lair.SHIELD_MS)
  assert.ok(lair.enterLair(beaten, config, t + 1000).error, "shielded boss refuses a challenge")
  assert.equal(lair.enterLair(beaten, config, t + lair.SHIELD_MS).error, undefined)

  // A partial tick only chips HP.
  const hurt = lair.tickLair(entered.run, config, 1000 + lair.LAIR_ATTACK_EVERY_MS)
  assert.ok(hurt.lair && hurt.lair.playerHp < lair.BASE_PLAYER_HP)

  // Forge the first weapon and armor from CORE + 코어 에너지.
  const rich = { ...base, coreEnergy: 1e9, regionCurrency: { signal_relay: 1e6 } }
  const w = lair.forgeGear(rich, config, "weapon")
  assert.equal(w.error, undefined)
  assert.equal(lair.gearOf(w.run).weapon, 1)
  const a = lair.forgeGear(w.run, config, "armor")
  assert.equal(lair.playerMaxHp(a.run), lair.BASE_PLAYER_HP + lair.ARMORS[1].hp)
  assert.ok(lair.forgeGear(base, config, "weapon").error, "can't forge broke")

  // Strike the boss down: it pays CORE and goes away to respawn.
  let fight = lair.enterLair(a.run, config, 1000).run
  let m = meta
  let result = lair.strikeLair(fight, m, config, 1100)
  while (!result.defeated) {
    fight = result.run
    m = result.meta
    result = lair.strikeLair(fight, m, config, 1100)
  }
  assert.ok(result.reward > 0)
  assert.equal(result.run.lair, null)
  assert.equal(eng.monsterAlive(result.run, "phase_vault", 1200), false)
})

test("drill upgrades: fewer taps per bore and a shorter cooldown", async () => {
  const eng = await import("./clicker-engine.ts")
  const run0 = eng.createInitialRun(0, eng.createInitialMeta(), clickerConfig)
  assert.equal(eng.drillTaps(run0, clickerConfig), eng.DRILL_TAPS)
  const base = eng.drillCooldownMs(run0, clickerConfig)
  const tuned = { ...run0, ownedUpgradeIds: ["drill_bit", "drill_coolant"] }
  assert.equal(eng.drillTaps(tuned, clickerConfig), eng.DRILL_TAPS - 5)
  assert.equal(eng.drillCooldownMs(tuned, clickerConfig), base - 5000)
  const maxed = { ...run0, ownedUpgradeIds: clickerConfig.upgrades.map((u) => u.id) }
  assert.ok(eng.drillTaps(maxed, clickerConfig) >= 8)
  assert.ok(eng.drillCooldownMs(maxed, clickerConfig) >= 5000)
})

test("instability: hoarding CORE and world currency pushes it up", async () => {
  const eng = await import("./clicker-engine.ts")
  const run0 = eng.createInitialRun(0, eng.createInitialMeta(), clickerConfig)
  assert.equal(eng.hoardInstabilityPerSecond({ ...run0, coreEnergy: 100 }, 10), 0)
  const some = eng.hoardInstabilityPerSecond({ ...run0, coreEnergy: 10 * 60 * 8 }, 10)
  const more = eng.hoardInstabilityPerSecond({ ...run0, coreEnergy: 10 * 60 * 8, regionCurrency: { signal_relay: 10 * 60 * 56 } }, 10)
  assert.ok(some > 0)
  assert.ok(more > some, "world currency counts toward the hoard")
})

test("fever: its timer and bonuses hold while you are outside the mine", async () => {
  const eng = await import("./clicker-engine.ts")
  const config = clickerConfig
  const meta = eng.createInitialMeta()
  const now = 5_000_000
  const base = eng.createInitialRun(now, meta, config)
  const charged = { ...base, ownedSkillNodeIds: ["focus_click", "fever_unlock"], fever: { ...base.fever, gauge: config.feverGaugeMax } }
  const lit = eng.startFever(charged, meta, config, "GAUGE", null)
  assert.equal(lit.error, undefined)
  const outside = { ...lit.run, mineSessionEndsAt: 0, lastTickAt: now }
  assert.ok(eng.feverPaused(outside))
  const held = eng.processTick(outside, meta, config, now + 1000).run
  assert.equal(held.fever.remainingTime, outside.fever.remainingTime)
  assert.equal(held.fever.phase, outside.fever.phase)

  const inside = { ...outside, mineSessionEndsAt: now + 60_000 }
  assert.ok(!eng.feverPaused(inside))
  const ran = eng.processTick(inside, meta, config, now + 1000).run
  assert.ok(ran.fever.remainingTime < inside.fever.remainingTime)
})

test("instability is switched off: the gauge stays at 0 and the core never collapses", async () => {
  const eng = await import("./clicker-engine.ts")
  const config = clickerConfig
  const meta = eng.createInitialMeta()
  const now = 7_000_000
  const run = { ...eng.createInitialRun(now, meta, config), coreEnergy: 1_000, instability: 100, lastTickAt: now }
  const after = eng.processTick(run, meta, config, now + 100).run
  assert.equal(after.instability, 0)
  assert.equal(after.lastCollapse, undefined)
  assert.ok(after.coreEnergy >= 1_000, "nothing is lost")
  // An old save stuck in a crisis is simply released on its next tick.
  const stuck = eng.processTick({ ...run, instability: 50, crisisActive: true }, meta, config, now + 100).run
  assert.equal(stuck.crisisActive, false)
  assert.equal(stuck.instability, 0)
})

test("mine re-entry waits 10s and pays less per session so CORE per minute is unchanged", () => {
  const now = 7_000_000
  const meta = createInitialMeta()
  const run = createInitialRun(now, meta, config)
  assert.equal(reentryCooldownMs(run, config), 10_000)
  const session = mineSessionDurationMs(run, config)
  const inMine = { ...run, mineSessionEndsAt: now + session, mineSessionDurationMs: session }
  const share = mineYieldMultiplier(inMine, config)
  assert.equal(share, 0.5)
  assert.equal(mineYieldMultiplier(run, config), 1, "outside a session nothing is scaled")
  // A full cycle of the old pace (10s mining + 30s wait) and of the new one (10s + 10s)
  // earn the same CORE per second of real time.
  const perClick = 100
  const oldPerSec = perClick / (session + 30_000)
  const newPerSec = (perClick * share) / (session + reentryCooldownMs(run, config))
  assert.ok(Math.abs(oldPerSec - newPerSec) < 1e-12)
  const hit = processClick(inMine, meta, config, now + 100, () => 0.99).result.energyGained
  const full = processClick({ ...inMine, mineSessionEndsAt: 0 }, meta, config, now + 100, () => 0.99).result.energyGained
  assert.ok(Math.abs(hit - full * share) < 1e-9)
})

test("pricier potions are stronger: boost-seconds rise with price", () => {
  const potions = [...config.potions].sort((a, b) => a.shopCost - b.shopCost)
  const power = (p: (typeof potions)[number]) => p.duration * (p.clickMultiplier - 1 + (p.productionMultiplier - 1))
  for (let i = 1; i < potions.length; i++) {
    assert.ok(power(potions[i]) > power(potions[i - 1]), `${potions[i].id} should beat ${potions[i - 1].id}`)
  }
})

test("worlds are late-run events: each opens in the back half of every worldline's goal", () => {
  const meta = createInitialMeta()
  const worlds = config.regions.filter((r) => !r.isHome && !r.requiresRebirths)
  for (let i = 1; i < worlds.length; i++) assert.ok(worlds[i].unlockAtLifetimeEnergy > worlds[i - 1].unlockAtLifetimeEnergy)
  for (const line of [1, 2, 4]) {
    const run = { ...createInitialRun(1_000, meta, config), currentWorldLine: line }
    const goal = worldlineGoal(config, line - 1)
    for (const w of worlds) {
      const share = regionUnlockThreshold(run, config, w) / goal
      assert.ok(share >= 0.2 && share < 1, `${w.id} opens at ${share} of worldline ${line}'s goal`)
    }
  }
})

test("secret code: typed anywhere, grants 100T CORE and of every world currency", async () => {
  const admin = await import("./clicker-admin-tools.ts")
  const eng = await import("./clicker-engine.ts")
  assert.equal(admin.typedSecretCode("xyz@kk960398"), true)
  assert.equal(admin.typedSecretCode("@kk96039"), false)
  const run = eng.createInitialRun(0, eng.createInitialMeta(), clickerConfig)
  const rich = admin.grantSecretCode(run, clickerConfig)
  assert.equal(rich.coreEnergy, run.coreEnergy + 1e14)
  assert.equal(rich.lifetimeCoreEnergy, run.lifetimeCoreEnergy, "spendable CORE only; it opens nothing on its own")
  for (const r of clickerConfig.regions.filter((x) => x.currency)) assert.equal(eng.regionCurrencyBalance(rich, r.id), 1e14)
})

test("sanitizeSave: NaN, Infinity and non-numeric values revert to defaults instead of poisoning the run", async () => {
  const eng = await import("./clicker-engine.ts")
  const base = eng.createInitialSave(0, config)
  const raw = JSON.parse(JSON.stringify(base))
  raw.runState.coreEnergy = "lots"
  raw.runState.skillPoints = Number.POSITIVE_INFINITY
  raw.runState.lifetimeCoreEnergy = Number.NaN
  raw.metaState.completedAt = Number.NaN
  raw.metaState.statistics.clicks = Number.POSITIVE_INFINITY
  raw.savedAt = Number.NaN
  const out = eng.sanitizeSave(raw, config, 1000)
  assert.equal(out.runState.coreEnergy, base.runState.coreEnergy)
  assert.equal(out.runState.skillPoints, base.runState.skillPoints)
  assert.equal(out.runState.lifetimeCoreEnergy, base.runState.lifetimeCoreEnergy)
  assert.equal(out.metaState.completedAt, null)
  assert.equal(out.metaState.statistics.clicks, 0)
  assert.equal(out.savedAt, 1000)
  const ticked = eng.processTick(out.runState, out.metaState, config, 5000)
  assert.ok(Number.isFinite(ticked.run.coreEnergy))
})

test("no skill circuit extends the combo window any more", () => {
  assert.deepEqual(config.skillNodes.filter((n) => n.comboWindowAdd).map((n) => n.id), [])
})

test("new active skills: crit surge, thunder call, fever ignite, cryo purge", () => {
  const now = 20_000_000
  const base = startClickerGame(createInitialSave(now, config))
  const owned = Object.fromEntries(["crit_surge", "thunder_call", "fever_ignite", "cryo_purge", "overclock"].map((id) => [id, 1]))
  let run = { ...base.runState, skillItems: owned, mineSessionEndsAt: now + 60_000 }
  const meta = base.metaState
  // Thunder call: a lightning storm for its duration.
  const thunder = activateSkill(run, meta, config, "thunder_call", now)
  assert.equal(thunder.error, undefined)
  assert.equal(thunder.run.lightningStormUntil, now + 10_000)
  // Fever ignite needs FEVER unlocked; a refusal keeps the charge.
  const refused = activateSkill(run, meta, config, "fever_ignite", now)
  assert.ok(refused.error)
  assert.equal(refused.run.skillItems.fever_ignite, 1)
  // Cryo purge clears other cooldowns and cools the core.
  run = { ...run, instability: 80, skillCooldowns: { overclock: 30 } }
  const purged = activateSkill(run, meta, config, "cryo_purge", now)
  assert.equal(purged.error, undefined)
  assert.equal(purged.run.skillCooldowns.overclock, 0)
  assert.ok(purged.run.instability < 80)
  // Crit surge adds crit chance while it runs.
  const surged = activateSkill(run, meta, config, "crit_surge", now)
  assert.equal(buffCritChance(surged.run, now + 1000, config), 0.6)
  assert.equal(buffCritChance(surged.run, now + 9000, config), 0)
})

test("active skills and potions only boost mining", () => {
  for (const s of config.activeSkills) assert.ok(!s.productionMultiplier && !s.energyBurstSeconds, s.id)
  for (const p of config.potions) assert.equal(p.productionMultiplier, 1, p.id)
  const now = 21_000_000
  const base = startClickerGame(createInitialSave(now, config))
  const run = { ...base.runState, skillItems: { core_pulse: 1 }, mineSessionEndsAt: now + 60_000 }
  const out = activateSkill(run, base.metaState, config, "core_pulse", now)
  const click = derivedClick(run, base.metaState, config).click
  assert.ok(Math.abs(out.run.coreEnergy - run.coreEnergy - click * 150) < 1e-9)
})
