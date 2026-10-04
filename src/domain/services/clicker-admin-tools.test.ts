import assert from "node:assert/strict"
import test from "node:test"
import { clickerConfig } from "../../data/clicker/catalog.ts"
import { createInitialSave } from "./clicker-engine.ts"
import {
  adminGrantCurrencies,
  adminJumpToFinalBoss,
  adminReplayTutorial,
  applyGodMode,
  applySpeedBoost,
  clampTutorialStep,
  finalBossRegionId,
  nextAdminSpeed,
  registerSecretTap,
  ADMIN_SECRET_TAPS,
} from "./clicker-admin-tools.ts"

const cfg = clickerConfig
const fresh = () => createInitialSave(1_000, cfg)

test("speed cycles 1 → 2 → 5 → 10 → 1", () => {
  assert.deepEqual([1, 2, 5, 10].map(nextAdminSpeed), [2, 5, 10, 1])
  assert.equal(nextAdminSpeed(3), 1)
})

test("currency grant credits every region currency", () => {
  const run = adminGrantCurrencies(fresh().runState, cfg, 500)
  for (const r of cfg.regions) if (r.currency) assert.equal(run.regionCurrency?.[r.id], 500)
  const again = adminGrantCurrencies(run, cfg, 500)
  assert.equal(again.regionCurrency?.deep_fault, 1000)
})

test("final boss is the core heart guardian", () => {
  assert.equal(finalBossRegionId(cfg), "core_heart")
})

test("jump to final boss unlocks, travels, skips the tutorial and starts the fight", () => {
  const save = adminJumpToFinalBoss(fresh(), cfg, 5_000)
  assert.equal(save.runState.currentRegionId, "core_heart")
  assert.equal(save.settings.tutorialSeen, true)
  assert.equal(save.settings.gameStarted, true)
  assert.equal(save.settings.playSurface, "hub")
  assert.ok(save.runState.boss)
  assert.equal(save.runState.boss?.hp, cfg.regions.find((r) => r.id === "core_heart")?.boss?.hp)
  assert.ok(save.runState.currentWorldLine >= 6)
  assert.ok(save.metaState.visitedRegionIds.includes("core_heart"))
})

test("replay tutorial clears the seen flag", () => {
  const s = adminReplayTutorial({ ...fresh(), settings: { ...fresh().settings, tutorialSeen: true } })
  assert.equal(s.settings.tutorialSeen, false)
})

test("god mode restores lost HP and keeps a fight the knockout would close", () => {
  const start = adminJumpToFinalBoss(fresh(), cfg, 5_000).runState
  const hurt = { ...start, boss: { ...start.boss!, playerHp: 40 } }
  assert.equal(applyGodMode(start, hurt).boss?.playerHp, start.boss!.playerMaxHp)
  const dead = { ...start, boss: null }
  const prev = { ...start, boss: { ...start.boss!, playerHp: 0 } }
  assert.ok(applyGodMode(prev, dead).boss)
  assert.equal(applyGodMode(start, start), start)
})

test("speed multiplies only positive CORE gains", () => {
  const prev = fresh().runState
  const next = { ...prev, coreEnergy: prev.coreEnergy + 10, lifetimeCoreEnergy: prev.lifetimeCoreEnergy + 10 }
  const boosted = applySpeedBoost(prev, next, 5)
  assert.equal(boosted.coreEnergy, prev.coreEnergy + 50)
  assert.equal(boosted.lifetimeCoreEnergy, prev.lifetimeCoreEnergy + 50)
  assert.equal(applySpeedBoost(prev, next, 1), next)
  const spent = { ...prev, coreEnergy: prev.coreEnergy - 5 }
  assert.equal(applySpeedBoost(prev, spent, 10), spent)
})

test("tutorial step clamps", () => {
  assert.equal(clampTutorialStep(-3, 7), 0)
  assert.equal(clampTutorialStep(99, 7), 6)
  assert.equal(clampTutorialStep(2.9, 7), 2)
  assert.equal(clampTutorialStep(1, 0), 0)
})

test("secret taps: N quick taps unlock, a pause resets", () => {
  let s = { count: 0, first: 0 }
  for (let i = 0; i < ADMIN_SECRET_TAPS - 1; i++) {
    const r = registerSecretTap(s, 100 + i * 200)
    assert.equal(r.unlocked, false)
    s = r.state
  }
  assert.equal(registerSecretTap(s, 100 + 6 * 200).unlocked, true)
  let slow = { count: 0, first: 0 }
  for (let i = 0; i < ADMIN_SECRET_TAPS; i++) {
    const r = registerSecretTap(slow, i * 3000)
    assert.equal(r.unlocked, false)
    slow = r.state
  }
})
