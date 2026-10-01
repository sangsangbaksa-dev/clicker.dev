import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import type { ClickerPersistencePort } from "./ports/clicker-persistence.ts"
import type { ClickerTabLockPort } from "./ports/clicker-tab-lock.ts"
import {
  bindClickerPersistence,
  bindClickerTabLock,
  clickerPersistence,
  resetClickerClientBindings,
} from "./clicker-client-bind.ts"
import {
  clickerCanWriteSave,
  clickerClaimLease,
  clickerCreateTabId,
  clickerIsLeaseTakenByOther,
} from "./clicker-tab-session.ts"

afterEach(() => {
  resetClickerClientBindings()
})

test("clickerPersistence uses in-memory fallback until bound", () => {
  assert.equal(clickerPersistence().readRaw(), null)
  clickerPersistence().writeRaw('{"ok":true}')
  assert.equal(clickerPersistence().readRaw(), '{"ok":true}')
})

test("fake persistence port is returned after bind", () => {
  const fake: ClickerPersistencePort = {
    readRaw: () => "raw",
    writeRaw: () => {},
    backupRaw: () => true,
    clearRaw: () => {},
  }
  bindClickerPersistence(fake)
  assert.equal(clickerPersistence().readRaw(), "raw")
})

test("tab session delegates to the bound tab-lock port", () => {
  const storage = new Map<string, string>()
  const leaseStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
  }
  const fake: ClickerTabLockPort = {
    createTabId: () => "tab-test",
    leaseStorage: () => leaseStorage,
    claimLease(tabId, now) {
      leaseStorage.setItem("aurelia-clicker-writer-v1", JSON.stringify({ tabId, claimedAt: now }))
    },
    canWriteSave(tabId, now) {
      const raw = leaseStorage.getItem("aurelia-clicker-writer-v1")
      if (!raw) return true
      const owner = JSON.parse(raw).tabId as string
      return owner === tabId
    },
    isLeaseTakenByOther(key, newValue, tabId) {
      if (key !== "aurelia-clicker-writer-v1" || !newValue) return false
      const owner = JSON.parse(newValue).tabId as string
      return owner !== tabId
    },
  }
  bindClickerTabLock(fake)
  assert.equal(clickerCreateTabId(), "tab-test")
  clickerClaimLease("tab-a", 1)
  assert.equal(clickerCanWriteSave("tab-a", 2), true)
  clickerClaimLease("tab-b", 3)
  assert.equal(clickerCanWriteSave("tab-a", 4), false)
  assert.equal(
    clickerIsLeaseTakenByOther(
      "aurelia-clicker-writer-v1",
      JSON.stringify({ tabId: "tab-b", claimedAt: 3 }),
      "tab-a",
    ),
    true,
  )
})
