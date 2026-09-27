import assert from "node:assert/strict"
import test from "node:test"
import { CONFIRM_ARM_MS, isConfirmReady } from "./clicker-confirm-guard.ts"

test("isConfirmReady ignores presses right after the button appears", () => {
  assert.equal(isConfirmReady(1_000, 1_000), false)
  // A double-click lands ~100-250ms after the first press.
  assert.equal(isConfirmReady(1_000, 1_250), false)
  assert.equal(isConfirmReady(1_000, 1_000 + CONFIRM_ARM_MS - 1), false)
})

test("isConfirmReady accepts presses once the arm delay has passed", () => {
  assert.equal(isConfirmReady(1_000, 1_000 + CONFIRM_ARM_MS), true)
  assert.equal(isConfirmReady(1_000, 60_000), true)
})

test("isConfirmReady stays closed until the button has been shown", () => {
  assert.equal(isConfirmReady(null, 5_000), false)
  assert.equal(isConfirmReady(Number.NaN, 5_000), false)
})

test("isConfirmReady does not lock forever if the clock goes backwards", () => {
  assert.equal(isConfirmReady(5_000, 4_000), true)
})

test("isConfirmReady honours a custom delay", () => {
  assert.equal(isConfirmReady(0, 100, 200), false)
  assert.equal(isConfirmReady(0, 200, 200), true)
})
