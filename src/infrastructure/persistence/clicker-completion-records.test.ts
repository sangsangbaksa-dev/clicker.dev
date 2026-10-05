import assert from "node:assert/strict"
import { beforeEach, test } from "node:test"
import {
  readClickerCompletionRecords,
  saveClickerCompletionRecord,
} from "./clicker-completion-records.ts"
import type { ClickerCompletionRecord } from "../../domain/services/clicker-completion-records.ts"

class MemoryStorage {
  data = new Map<string, string>()
  failWrites = false
  getItem(key: string) {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error("QuotaExceededError")
    this.data.set(key, value)
  }
}

const KEY = "aurelia-clicker-completions-v1"
let store: MemoryStorage
const record = (completedAt: number, playTimeMs: number): ClickerCompletionRecord => ({
  completedAt,
  playTimeMs,
  totalCoreEnergy: 500,
  rebirthCount: 8,
  worldlinesOwned: 8,
  clicks: 99,
})

beforeEach(() => {
  store = new MemoryStorage()
  ;(globalThis as { window?: unknown }).window = { localStorage: store }
})

test("completion records persist separately and are read in ranking order", () => {
  assert.equal(saveClickerCompletionRecord(record(100, 20_000)), true)
  assert.equal(saveClickerCompletionRecord(record(200, 10_000)), true)
  assert.deepEqual(readClickerCompletionRecords(), {
    available: true,
    records: [record(200, 10_000), record(100, 20_000)],
  })
  assert.equal(store.data.has("aurelia-clicker-save-v1"), false)
})

test("saving the same completion twice does not duplicate its local rank entry", () => {
  saveClickerCompletionRecord(record(100, 20_000))
  saveClickerCompletionRecord(record(100, 20_000))
  assert.equal(readClickerCompletionRecords().records.length, 1)
})

test("unavailable or malformed local storage is surfaced as unavailable", () => {
  ;(globalThis as { window?: unknown }).window = undefined
  assert.deepEqual(readClickerCompletionRecords(), { available: false, records: [] })
  ;(globalThis as { window?: unknown }).window = { localStorage: store }
  store.data.set(KEY, "{")
  assert.equal(readClickerCompletionRecords().available, false)
})

test("a failed write reports failure without hiding the completed game", () => {
  store.failWrites = true
  assert.equal(saveClickerCompletionRecord(record(100, 20_000)), false)
})
