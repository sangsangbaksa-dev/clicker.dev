import assert from "node:assert/strict"
import test from "node:test"
import { clickerConfig as config } from "../../data/clicker/catalog.ts"
import { createInitialSave, sanitizeSave } from "./clicker-engine.ts"
import { chronicleSummary, recordWorldline, worldlineDurationMs } from "./clicker-chronicle.ts"

const NOW = 1_000_000

test("records a finished worldline once", () => {
  const s = createInitialSave(NOW, config)
  const run = { ...s.runState, runStartedAt: NOW, currentWorldLine: 1, lifetimeCoreEnergy: 5e9 }
  const meta = { ...s.metaState, statistics: { ...s.metaState.statistics, maxCombo: 42 } }
  const m1 = recordWorldline(meta, run, "buff_a", NOW + 60_000)
  assert.equal(m1.chronicle!.length, 1)
  assert.deepEqual(m1.chronicle![0], { worldLine: 1, transcendenceId: "buff_a", startedAt: NOW, endedAt: NOW + 60_000, maxCombo: 42, lifetimeCore: 5e9 })
  assert.equal(recordWorldline(m1, run, "buff_b", NOW + 90_000), m1)
  assert.equal(worldlineDurationMs(m1.chronicle![0]), 60_000)
})

test("summary: count, total, fastest, best combo, complete only after the ending", () => {
  const s = createInitialSave(NOW, config)
  let meta = s.metaState
  meta = recordWorldline(meta, { ...s.runState, currentWorldLine: 1, runStartedAt: 0 }, "a", 300_000)
  meta = recordWorldline({ ...meta, statistics: { ...meta.statistics, maxCombo: 9 } }, { ...s.runState, currentWorldLine: 2, runStartedAt: 300_000 }, null, 400_000)
  const sum = chronicleSummary(meta)
  assert.equal(sum.worldlines, 2)
  assert.equal(sum.totalMs, 400_000)
  assert.equal(sum.fastest!.worldLine, 2)
  assert.equal(sum.bestCombo, 9)
  assert.equal(sum.complete, false)
  assert.equal(chronicleSummary({ ...meta, gameCompleted: true }).complete, true)
})

test("empty and old saves: no chronicle, summary is zero", () => {
  const s = createInitialSave(NOW, config)
  assert.equal(sanitizeSave(JSON.parse(JSON.stringify(s)), config, NOW).metaState.chronicle, undefined)
  assert.deepEqual(chronicleSummary(s.metaState), { worldlines: 0, totalMs: 0, fastest: null, bestCombo: 0, complete: false })
  const bad = { ...s, metaState: { ...s.metaState, chronicle: [null, { worldLine: "x" }, { worldLine: 1, startedAt: 0, endedAt: 5 }] } }
  assert.equal(sanitizeSave(bad, config, NOW).metaState.chronicle!.length, 1)
})
