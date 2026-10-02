import assert from "node:assert/strict"
import { beforeEach, test } from "node:test"
import { handoffClickerSaveForAccount } from "./clicker-account-save-handoff.ts"
import {
  getClickerSaveSlotLoginId,
  readClickerRawAtLoginId,
  setClickerSaveSlotLoginId,
  writeClickerRawAtLoginId,
} from "./clicker-save.ts"

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

beforeEach(() => {
  setClickerSaveSlotLoginId(null)
  ;(globalThis as { window?: unknown }).window = { localStorage: new MemoryStorage() }
})

test("login copies guest progress into an empty account slot", () => {
  writeClickerRawAtLoginId(null, '{"guest":1}')
  handoffClickerSaveForAccount(null, "alice")
  assert.equal(getClickerSaveSlotLoginId(), "alice")
  assert.equal(readClickerRawAtLoginId("alice"), '{"guest":1}')
})

test("logout mirrors account progress to the guest slot", () => {
  writeClickerRawAtLoginId("alice", '{"run":2}')
  setClickerSaveSlotLoginId("alice")
  handoffClickerSaveForAccount("alice", null)
  assert.equal(getClickerSaveSlotLoginId(), null)
  assert.equal(readClickerRawAtLoginId(null), '{"run":2}')
})
