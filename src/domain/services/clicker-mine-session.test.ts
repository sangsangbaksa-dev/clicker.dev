import assert from "node:assert/strict"
import test from "node:test"
import { clickerConfig as config } from "../../data/clicker/catalog.ts"
import { createInitialSave, enterClickerMine, sanitizeSave, syncClickerMineSession } from "./clicker-engine.ts"
import { mineSessionStart, recordMineSession, summarizeMineSession } from "./clicker-mine-session.ts"

const NOW = 30_000_000

test("session summary diffs lifetime CORE and counters", () => {
  const save = createInitialSave(NOW, config)
  const start = mineSessionStart(save, NOW)
  const after = {
    ...save,
    runState: { ...save.runState, lifetimeCoreEnergy: 500, coreEnergy: 120 },
    metaState: {
      ...save.metaState,
      statistics: {
        ...save.metaState.statistics,
        clicks: 40,
        crits: 6,
        oresBroken: 1,
        veins: 1,
        monstersSlain: 3,
        vaultLocks: 2,
      },
    },
  }
  const summary = summarizeMineSession(start, after, NOW + 12_400)
  assert.deepEqual(summary, {
    haul: 500,
    strikes: 40,
    crits: 6,
    oresBroken: 1,
    veins: 1,
    monstersSlain: 3,
    vaultLocks: 2,
    seconds: 12,
  })
})

test("session summary without a start falls back to the CORE-at-enter mark", () => {
  const save = createInitialSave(NOW, config)
  const inMine = {
    ...save,
    runState: { ...save.runState, coreEnergy: 90, mineSessionCoreAtEnter: 30, mineSessionDurationMs: 10_000 },
  }
  const summary = summarizeMineSession(null, inMine, NOW)
  assert.equal(summary.haul, 60)
  assert.equal(summary.strikes, 0)
  assert.equal(summary.seconds, 10)
})

test("best haul only moves up", () => {
  const meta = createInitialSave(NOW, config).metaState
  const first = recordMineSession(meta, 200)
  assert.equal(first.best, true)
  assert.equal(first.meta.statistics.bestMineHaul, 200)
  assert.equal(first.meta.statistics.mineSessions, 1)
  const second = recordMineSession(first.meta, 150)
  assert.equal(second.best, false)
  assert.equal(second.previousBest, 200)
  assert.equal(second.meta.statistics.bestMineHaul, 200)
  assert.equal(second.meta.statistics.mineSessions, 2)
  assert.equal(recordMineSession(meta, 0).best, false)
})

test("old saves without the new statistics load with zeros", () => {
  const save = createInitialSave(NOW, config)
  const legacy = JSON.parse(JSON.stringify(save))
  delete legacy.metaState.statistics.bestMineHaul
  delete legacy.metaState.statistics.mineSessions
  const loaded = sanitizeSave(legacy, config, NOW)
  assert.equal(loaded.metaState.statistics.bestMineHaul, 0)
  assert.equal(loaded.metaState.statistics.mineSessions, 0)
})

test("timeout returns the player to the hub and starts one cooldown", () => {
  const save = { ...createInitialSave(NOW, config), settings: { ...createInitialSave(NOW, config).settings, gameStarted: true } }
  const entered = enterClickerMine(save, NOW, config).save
  const ended = syncClickerMineSession(entered, NOW + 60_000)
  assert.equal(ended.settings.playSurface, "hub")
  const cooldown = ended.runState.mineCooldownUntil
  // A later tick must not keep pushing the cooldown out.
  assert.equal(syncClickerMineSession(ended, NOW + 61_000).runState.mineCooldownUntil, cooldown)
})
