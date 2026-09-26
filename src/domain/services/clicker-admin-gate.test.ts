import assert from "node:assert/strict"
import test from "node:test"
import { isClickerAdminAllowed } from "./clicker-admin-gate.ts"

test("clicker admin gate blocks production builds", () => {
  assert.equal(isClickerAdminAllowed({ nodeEnv: "production" }), false)
  assert.equal(isClickerAdminAllowed({ nodeEnv: "Production" }), false)
})

test("clicker admin gate allows every non-production build without a flag", () => {
  assert.equal(isClickerAdminAllowed({ nodeEnv: "development" }), true)
  assert.equal(isClickerAdminAllowed({ nodeEnv: "test" }), true)
})
