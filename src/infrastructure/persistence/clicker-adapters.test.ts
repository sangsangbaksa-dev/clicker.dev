import assert from "node:assert/strict"
import { afterEach, beforeEach, test } from "node:test"
import { browserClickerPersistence } from "./clicker-persistence-adapter.ts"
import { browserClickerTabLock } from "./clicker-tab-lock-adapter.ts"
import { CLICKER_LOCK_KEY } from "./clicker-tab-lock.ts"

class MemoryStorage {
  data = new Map<string, string>()
  getItem(key: string) {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.data.set(key, value)
  }
  removeItem(key: string) {
    this.data.delete(key)
  }
}

let store: MemoryStorage

beforeEach(() => {
  store = new MemoryStorage()
  ;(globalThis as { window?: { localStorage: MemoryStorage } }).window = { localStorage: store }
})

afterEach(() => {
  delete (globalThis as { window?: unknown }).window
})

test("browserClickerPersistence adapter reads and writes raw JSON", () => {
  assert.equal(browserClickerPersistence.readRaw(), null)
  browserClickerPersistence.writeRaw('{"v":1}')
  assert.equal(browserClickerPersistence.readRaw(), '{"v":1}')
  browserClickerPersistence.clearRaw()
  assert.equal(browserClickerPersistence.readRaw(), null)
})

test("browserClickerTabLock adapter enforces single-writer lease", () => {
  const a = browserClickerTabLock.createTabId()
  const b = browserClickerTabLock.createTabId()
  assert.notEqual(a, b)
  browserClickerTabLock.claimLease(a, 1)
  assert.equal(browserClickerTabLock.canWriteSave(a, 2), true)
  browserClickerTabLock.claimLease(b, 3)
  assert.equal(browserClickerTabLock.canWriteSave(a, 4), false)
  assert.equal(browserClickerTabLock.canWriteSave(b, 4), true)
  const raw = store.data.get(CLICKER_LOCK_KEY) ?? null
  assert.equal(browserClickerTabLock.isLeaseTakenByOther(CLICKER_LOCK_KEY, raw, a), true)
})
