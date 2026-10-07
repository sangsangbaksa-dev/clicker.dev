import assert from "node:assert/strict"
import test from "node:test"
import { clickerConfig as config } from "../../data/clicker/catalog.ts"
import { createInitialSave, startBossFight } from "./clicker-engine.ts"
import { advancePostgame, continueAfterEnding, postgameDepthGoal } from "./clicker-postgame.ts"
import {
  AWAKENED_HP_GROWTH,
  awakenFight,
  awakenedGuardianAvailable,
  awakenedGuardianLabel,
  awakenedHpMultiplier,
  awakenedReward,
  claimAwakenedVictory,
  getAwakenedWins,
  isAwakenedFight,
} from "./clicker-guardian-rematch.ts"

const NOW = 1_000_000
const save = createInitialSave(NOW, config)
const done = { ...save.metaState, gameCompleted: true, completedAt: NOW, bossDefeated: true, totalCoreEnergy: 1e12 }
const dawn = continueAfterEnding(done, NOW).meta
const heartRun = { ...save.runState, currentRegionId: config.regions.find((r) => r.boss)!.id, currentWorldLine: 9 }

test("locked before 새벽의 광산 (and before the ending)", () => {
  assert.equal(awakenedGuardianAvailable(save.metaState), false)
  assert.equal(awakenedGuardianAvailable(done), false)
  assert.ok(awakenedGuardianAvailable(dawn))
})

test("health grows with dawn depth; reward grows every 5 depths", () => {
  assert.ok(Math.abs(awakenedHpMultiplier(4) / awakenedHpMultiplier(3) - AWAKENED_HP_GROWTH) < 1e-9)
  assert.ok(awakenedHpMultiplier(0) > 1, "tougher than the normal guardian")
  assert.equal(awakenedReward(0), 3)
  assert.equal(awakenedReward(4), 3)
  assert.equal(awakenedReward(5), 4)
  assert.equal(awakenedReward(Number.NaN), 3)
  assert.equal(awakenedGuardianLabel(3), "각성 수호자 · 깊이 3")
})

test("awakened fight scales the normal fight and pays shards on a win", () => {
  const base = startBossFight(heartRun, dawn, config, NOW).run.boss!
  assert.equal(isAwakenedFight(base), false)
  const deep = advancePostgame(dawn, postgameDepthGoal(0, dawn.postgame!.base) + postgameDepthGoal(1, dawn.postgame!.base)).meta
  const fight = awakenFight(base, deep)
  assert.ok(isAwakenedFight(fight))
  assert.equal(fight.awakenedDepth, 2)
  assert.ok(Math.abs(fight.maxHp / base.maxHp - awakenedHpMultiplier(2)) < 1e-9)
  assert.equal(fight.hp, fight.maxHp)
  const won = claimAwakenedVictory(deep, fight)
  assert.equal(won.reward, 3)
  assert.equal(won.meta.postgame!.shards, deep.postgame!.shards + 3)
  assert.equal(getAwakenedWins(won.meta), 1)
})

test("a normal guardian win or a pre-dawn save pays nothing", () => {
  const base = startBossFight(heartRun, dawn, config, NOW).run.boss!
  assert.equal(claimAwakenedVictory(dawn, base).reward, 0)
  assert.equal(claimAwakenedVictory(done, { ...base, awakened: true }).reward, 0)
  assert.equal(getAwakenedWins(done), 0)
})
