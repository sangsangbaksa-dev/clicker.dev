import assert from "node:assert/strict"
import test from "node:test"
import {
  CLICKER_LOCK_KEY,
  canWriteClickerSave,
  claimClickerLease,
  createClickerTabId,
  isLeaseTakenByOther,
  readLeaseOwner,
  type LeaseStorage,
} from "./clicker-tab-lock.ts"

function memoryStorage(): LeaseStorage & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  }
}

test("the most recently opened tab owns the save; the older tab stops writing", () => {
  const storage = memoryStorage()
  claimClickerLease(storage, "tab-a", 1)
  assert.equal(canWriteClickerSave(storage, "tab-a", 2), true)

  claimClickerLease(storage, "tab-b", 3)
  assert.equal(canWriteClickerSave(storage, "tab-a", 4), false)
  assert.equal(canWriteClickerSave(storage, "tab-b", 4), true)
})

test("resuming in the older tab takes the lease back", () => {
  const storage = memoryStorage()
  claimClickerLease(storage, "tab-a", 1)
  claimClickerLease(storage, "tab-b", 2)
  claimClickerLease(storage, "tab-a", 3)
  assert.equal(canWriteClickerSave(storage, "tab-a", 4), true)
  assert.equal(canWriteClickerSave(storage, "tab-b", 4), false)
})

test("an unowned or corrupt lease is claimed by the first writer", () => {
  const storage = memoryStorage()
  assert.equal(canWriteClickerSave(storage, "tab-a", 1), true)
  assert.equal(readLeaseOwner(storage.data.get(CLICKER_LOCK_KEY) ?? null), "tab-a")
  assert.equal(canWriteClickerSave(storage, "tab-b", 2), false)

  storage.data.set(CLICKER_LOCK_KEY, "{not json")
  assert.equal(canWriteClickerSave(storage, "tab-b", 3), true)
  assert.equal(readLeaseOwner(storage.data.get(CLICKER_LOCK_KEY) ?? null), "tab-b")
})

test("unavailable storage fails open instead of freezing the game", () => {
  const throwing: LeaseStorage = {
    getItem: () => {
      throw new Error("SecurityError")
    },
    setItem: () => {
      throw new Error("QuotaExceededError")
    },
  }
  assert.doesNotThrow(() => claimClickerLease(throwing, "tab-a", 1))
  assert.equal(canWriteClickerSave(throwing, "tab-a", 1), true)
  assert.equal(canWriteClickerSave(null, "tab-a", 1), true)
})

test("storage events flag a takeover only when another tab claims the lease", () => {
  const other = JSON.stringify({ tabId: "tab-b", claimedAt: 1 })
  const mine = JSON.stringify({ tabId: "tab-a", claimedAt: 1 })
  assert.equal(isLeaseTakenByOther(CLICKER_LOCK_KEY, other, "tab-a"), true)
  assert.equal(isLeaseTakenByOther(CLICKER_LOCK_KEY, mine, "tab-a"), false)
  assert.equal(isLeaseTakenByOther(CLICKER_LOCK_KEY, null, "tab-a"), false)
  assert.equal(isLeaseTakenByOther("aurelia-clicker-save-v1", other, "tab-a"), false)
  assert.equal(isLeaseTakenByOther(null, null, "tab-a"), false)
})

test("tab ids are unique per tab", () => {
  const a = createClickerTabId()
  const b = createClickerTabId()
  assert.ok(a)
  assert.notEqual(a, b)
})
