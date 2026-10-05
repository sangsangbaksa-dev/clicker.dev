import assert from "node:assert/strict"
import test from "node:test"
import {
  CLICKER_ADMIN_CODE_MS,
  grantClickerAdminByCode,
  isClickerAdminAllowed,
  isClickerAdminHost,
  revokeClickerAdminCode,
} from "./clicker-admin-gate.ts"

test("clicker admin host detects loopback names", () => {
  assert.equal(isClickerAdminHost("localhost"), true)
  assert.equal(isClickerAdminHost("127.0.0.1"), true)
  assert.equal(isClickerAdminHost("::1"), true)
  assert.equal(isClickerAdminHost("preview.vercel.app"), false)
})

test("clicker admin gate blocks production builds after launch", () => {
  assert.equal(
    isClickerAdminAllowed({ nodeEnv: "production", hostname: "localhost", search: "", prelaunch: false }),
    false
  )
  assert.equal(
    isClickerAdminAllowed({ nodeEnv: "production", hostname: "localhost", search: "?admin=1", prelaunch: false }),
    false
  )
  assert.equal(
    isClickerAdminAllowed({ nodeEnv: "production", hostname: "preview.vercel.app", search: "?admin=1", prelaunch: false, remembered: true }),
    false
  )
  assert.equal(
    isClickerAdminAllowed({ nodeEnv: "Production", hostname: "localhost", search: "?admin=1", prelaunch: false }),
    false
  )
})

test("clicker admin gate allows localhost in development", () => {
  assert.equal(
    isClickerAdminAllowed({ nodeEnv: "development", hostname: "localhost", search: "" }),
    true
  )
  assert.equal(
    isClickerAdminAllowed({ nodeEnv: "development", hostname: "127.0.0.1", search: "" }),
    true
  )
  assert.equal(
    isClickerAdminAllowed({ nodeEnv: "development", hostname: "::1", search: "" }),
    true
  )
})

test("clicker admin gate allows dev ?admin=1 for local playtest", () => {
  assert.equal(
    isClickerAdminAllowed({ nodeEnv: "development", hostname: "192.168.0.42", search: "?admin=1" }),
    true
  )
  assert.equal(
    isClickerAdminAllowed({ nodeEnv: "development", hostname: "preview.vercel.app", search: "" }),
    false
  )
})

test("clicker admin gate: before launch, production opens only with ?admin=1 or a remembered visit", () => {
  const live = { nodeEnv: "production", hostname: "clicker.example.com", prelaunch: true }
  assert.equal(isClickerAdminAllowed({ ...live, search: "" }), false)
  assert.equal(isClickerAdminAllowed({ ...live, search: "?admin=1" }), true)
  assert.equal(isClickerAdminAllowed({ ...live, search: "", remembered: true }), true)
  assert.equal(isClickerAdminAllowed({ ...live, search: "?admin=0" }), false)
})

test("clicker admin gate: the secret code opens admin for 10 seconds only", () => {
  const live = { nodeEnv: "production", hostname: "clicker.example.com", search: "", prelaunch: false, remembered: false }
  const until = grantClickerAdminByCode(Date.now())
  assert.equal(until - Date.now() <= CLICKER_ADMIN_CODE_MS, true)
  assert.equal(isClickerAdminAllowed(live), true)
  revokeClickerAdminCode()
  assert.equal(isClickerAdminAllowed(live), false)
  // A window granted 10s ago has already closed.
  grantClickerAdminByCode(Date.now() - CLICKER_ADMIN_CODE_MS - 1)
  assert.equal(isClickerAdminAllowed(live), false)
})
