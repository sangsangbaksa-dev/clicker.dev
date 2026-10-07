import assert from "node:assert/strict"
import test from "node:test"
import { clickerConfig as config } from "../../data/clicker/catalog.ts"
import { LATE_GAME_ACHIEVEMENTS } from "../../data/clicker/achievements-lategame.ts"
import { achievementProgress, awardAchievements } from "./clicker-bonus.ts"
import { createInitialSave, sanitizeSave } from "./clicker-engine.ts"
import { lateGameProgress, optionalPostgameDepth } from "./clicker-achievements-lategame.ts"

const NOW = 20_000_000
const fresh = () => createInitialSave(NOW, config)

test("late-game defs are registered with unique ids", () => {
  const ids = config.achievements.map((a) => a.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const d of LATE_GAME_ACHIEVEMENTS) assert.ok(ids.includes(d.id))
})

test("fresh save unlocks no late-game achievement", () => {
  const s = fresh()
  const r = awardAchievements(s.runState, s.metaState, LATE_GAME_ACHIEVEMENTS)
  assert.equal(r.unlocked.length, 0)
})

test("progress per kind", () => {
  const s = fresh()
  const meta = {
    ...s.metaState,
    bossDefeated: true,
    gameCompleted: true,
    transcendenceIds: ["a", "b", "a"],
    relicLevels: { x: 3, y: 2 },
    gachaPulls: 51,
    gachaCounts: { legendary: 2 },
  }
  assert.equal(lateGameProgress("BOSS", meta), 1)
  assert.equal(lateGameProgress("ENDING", meta), 1)
  assert.equal(lateGameProgress("TRANSCENDENCE", meta), 2)
  assert.equal(lateGameProgress("RELIC_LEVELS", meta), 5)
  assert.equal(achievementProgress("GACHA_PULLS", s.runState, meta), 51)
  assert.equal(achievementProgress("GACHA_LEGENDARY", s.runState, meta), 2)
  const r = awardAchievements(s.runState, meta, LATE_GAME_ACHIEVEMENTS)
  assert.deepEqual(r.unlocked.map((d) => d.id).sort(), ["boss_guardian", "ending_true", "gacha_50", "gacha_leg_1", "relic_1"])
  assert.equal(awardAchievements(s.runState, r.meta, LATE_GAME_ACHIEVEMENTS).unlocked.length, 0)
})

test("dawn depth: optional selector is safe when postgame is missing", () => {
  const s = fresh()
  assert.equal(optionalPostgameDepth(s.metaState), 0)
  assert.equal(optionalPostgameDepth({ ...s.metaState, postgame: null } as never), 0)
  assert.equal(optionalPostgameDepth({ ...s.metaState, postgame: { depth: "x" } } as never), 0)
  assert.equal(optionalPostgameDepth({ ...s.metaState, postgame: { depth: 10.7 } } as never), 10)
  assert.equal(lateGameProgress("POSTGAME_DEPTH", s.metaState, () => 25), 25)
})

test("old saves without late-game fields stay compatible", () => {
  const s = fresh()
  const old = JSON.parse(JSON.stringify(s))
  for (const k of ["relicLevels", "gachaPulls", "gachaCounts"]) delete old.metaState[k]
  const loaded = sanitizeSave(old, config, NOW)
  for (const d of LATE_GAME_ACHIEVEMENTS) assert.equal(achievementProgress(d.kind, loaded.runState, loaded.metaState) >= 0, true)
})

test("late-game achievements add 0% production; old ones still add 1%", async () => {
  const { achievementProductionMultiplier, ACHIEVEMENT_PRODUCTION_BONUS } = await import("./clicker-bonus.ts")
  const m = fresh().metaState
  const late = { ...m, achievementIds: LATE_GAME_ACHIEVEMENTS.map((d) => d.id) }
  assert.equal(achievementProductionMultiplier(late, config.achievements), 1)
  const mixed = { ...m, achievementIds: ["clicks_100", "prod_10", "boss_guardian"] }
  assert.ok(Math.abs(achievementProductionMultiplier(mixed, config.achievements) - (1 + 2 * ACHIEVEMENT_PRODUCTION_BONUS)) < 1e-12)
  assert.ok(LATE_GAME_ACHIEVEMENTS.every((d) => d.grantsProductionBonus === false))
})

test("default dawn reader uses #1 getDawnDepth", async () => {
  const { getDawnDepth } = await import("./clicker-postgame.ts")
  const { dawnDepthReader } = await import("./clicker-achievements-lategame.ts")
  const m = fresh().metaState
  assert.equal(dawnDepthReader(m), 0)
  assert.equal(lateGameProgress("POSTGAME_DEPTH", m), getDawnDepth(m))
})
