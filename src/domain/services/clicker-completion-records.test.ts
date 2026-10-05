import assert from "node:assert/strict"
import test from "node:test"
import { clickerConfig } from "../../data/clicker/catalog.ts"
import { createInitialMeta } from "./clicker-engine.ts"
import {
  clickerCompletionRank,
  clickerPlayTimeMs,
  createClickerCompletionRecord,
  formatClickerPlayTime,
  sortClickerCompletionRecords,
  type ClickerCompletionRecord,
} from "./clicker-completion-records.ts"

const record = (completedAt: number, playTimeMs: number): ClickerCompletionRecord => ({
  completedAt,
  playTimeMs,
  totalCoreEnergy: 100,
  rebirthCount: 8,
  worldlinesOwned: clickerConfig.transcendence.length,
  clicks: 500,
})

test("new runs measure playtime from the first title start to the true ending", () => {
  const meta = {
    ...createInitialMeta(),
    startedAt: 12_000,
    gameCompleted: true,
    completedAt: 3_612_345,
    totalCoreEnergy: 1_000,
    rebirthCount: 8,
    transcendenceIds: ["a", "b"],
    statistics: { ...createInitialMeta().statistics, clicks: 42 },
  }
  assert.equal(clickerPlayTimeMs(meta), 3_600_345)
  assert.deepEqual(createClickerCompletionRecord(meta), {
    completedAt: 3_612_345,
    playTimeMs: 3_600_345,
    totalCoreEnergy: 1_000,
    rebirthCount: 8,
    worldlinesOwned: 2,
    clicks: 42,
  })
})

test("legacy or invalid start times are not presented as measured playtime", () => {
  const meta = { ...createInitialMeta(), gameCompleted: true, completedAt: 1_000 }
  assert.equal(clickerPlayTimeMs(meta), null)
  assert.equal(createClickerCompletionRecord(meta), null)
  assert.equal(clickerPlayTimeMs({ startedAt: 2_000, completedAt: 1_000 }), null)
})

test("completion ranking is fastest-first with deterministic ties", () => {
  const records = [record(300, 20_000), record(200, 10_000), record(100, 10_000)]
  assert.deepEqual(sortClickerCompletionRecords(records).map((entry) => entry.completedAt), [100, 200, 300])
  assert.equal(clickerCompletionRank(records, 200), 2)
  assert.equal(clickerCompletionRank(records, 999), null)
})

test("playtime uses readable clock units without overstating elapsed seconds", () => {
  assert.equal(formatClickerPlayTime(59_999), "59초")
  assert.equal(formatClickerPlayTime(125_000), "2분 05초")
  assert.equal(formatClickerPlayTime(3_723_000), "1시간 02분 03초")
})
