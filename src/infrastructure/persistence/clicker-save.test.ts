import assert from "node:assert/strict"
import { beforeEach, test } from "node:test"
import {
  BACKUP_KEY,
  MAX_CLICKER_BACKUPS,
  backupClickerRaw,
  readClickerBackups,
  readClickerRaw,
  writeClickerRaw,
} from "./clicker-save.ts"

class MemoryStorage {
  data = new Map<string, string>()
  quota = Infinity
  getItem(key: string) {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string) {
    if (value.length > this.quota) throw new Error("QuotaExceededError")
    this.data.set(key, value)
  }
  removeItem(key: string) {
    this.data.delete(key)
  }
}

let store: MemoryStorage

beforeEach(() => {
  store = new MemoryStorage()
  ;(globalThis as { window?: unknown }).window = { localStorage: store }
})

test("backups live under their own key, so autosave cannot overwrite them", () => {
  writeClickerRaw("{broken")
  assert.equal(backupClickerRaw("{broken", "corrupt", 1), true)
  writeClickerRaw('{"fresh":true}')
  assert.equal(readClickerRaw(), '{"fresh":true}')
  assert.deepEqual(readClickerBackups(), [{ at: 1, reason: "corrupt", raw: "{broken" }])
})

test("identical raw saves are backed up once", () => {
  backupClickerRaw("a", "corrupt", 1)
  backupClickerRaw("a", "corrupt", 2)
  assert.equal(readClickerBackups().length, 1)
})

test("only the newest backups are kept", () => {
  for (let i = 0; i < MAX_CLICKER_BACKUPS + 2; i++) backupClickerRaw(`raw-${i}`, "corrupt", i)
  const backups = readClickerBackups()
  assert.equal(backups.length, MAX_CLICKER_BACKUPS)
  assert.equal(backups[0]!.raw, `raw-${MAX_CLICKER_BACKUPS + 1}`)
})

test("on quota errors older backups are dropped to fit the new one", () => {
  backupClickerRaw("x".repeat(40), "corrupt", 1)
  store.quota = 120
  assert.equal(backupClickerRaw("y".repeat(40), "corrupt", 2), true)
  assert.deepEqual(readClickerBackups().map((b) => b.at), [2])
})

test("reports failure when the backup cannot be stored at all", () => {
  store.quota = 10
  assert.equal(backupClickerRaw("z".repeat(40), "corrupt", 1), false)
})

test("a garbled backup list reads as empty", () => {
  store.setItem(BACKUP_KEY, "not json")
  assert.deepEqual(readClickerBackups(), [])
})
