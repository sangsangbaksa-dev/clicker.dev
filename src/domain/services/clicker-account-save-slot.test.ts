import assert from "node:assert/strict"
import test from "node:test"
import {
  clickerSaveStorageKey,
  planClickerSaveHandoff,
} from "./clicker-account-save-slot.ts"

test("save keys isolate accounts from the guest slot", () => {
  assert.equal(clickerSaveStorageKey(null), "aurelia-clicker-save-v1")
  assert.equal(clickerSaveStorageKey("miner01"), "aurelia-clicker-save-v1:acct:miner01")
})

test("first login copies guest progress when the account slot is empty", () => {
  assert.deepEqual(planClickerSaveHandoff(null, "a", true, false), { kind: "copy-guest-into-account" })
  assert.deepEqual(planClickerSaveHandoff(null, "a", true, true), { kind: "switch-only" })
  assert.deepEqual(planClickerSaveHandoff(null, "a", false, false), { kind: "switch-only" })
})

test("logout mirrors account progress back to the guest slot", () => {
  assert.deepEqual(planClickerSaveHandoff("a", null, true, true), { kind: "mirror-account-to-guest-on-logout" })
})
