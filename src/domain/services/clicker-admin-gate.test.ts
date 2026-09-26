import assert from "node:assert/strict"
import test from "node:test"
import { isClickerAdminAllowed, isClickerAdminHost } from "./clicker-admin-gate.ts"

test("clicker admin host detects loopback names", () => {
  assert.equal(isClickerAdminHost("localhost"), true)
  assert.equal(isClickerAdminHost("127.0.0.1"), true)
  assert.equal(isClickerAdminHost("::1"), true)
  assert.equal(isClickerAdminHost("preview.vercel.app"), false)
})

test("clicker admin gate stays closed in production until switched on", () => {
  assert.equal(
    isClickerAdminAllowed({ nodeEnv: "production", hostname: "localhost", search: "", enabled: false }),
    false
  )
  assert.equal(
    isClickerAdminAllowed({ nodeEnv: "Production", hostname: "example.com", search: "", enabled: false }),
    false
  )
})

test("clicker admin gate opens from the Settings switch or ?admin=1 in any build", () => {
  assert.equal(
    isClickerAdminAllowed({ nodeEnv: "production", hostname: "example.com", search: "", enabled: true }),
    true
  )
  assert.equal(
    isClickerAdminAllowed({ nodeEnv: "production", hostname: "example.com", search: "?admin=1", enabled: false }),
    true
  )
})

test("clicker admin gate allows localhost in development", () => {
  assert.equal(
    isClickerAdminAllowed({ nodeEnv: "development", hostname: "localhost", search: "", enabled: false }),
    true
  )
  assert.equal(
    isClickerAdminAllowed({ nodeEnv: "development", hostname: "127.0.0.1", search: "", enabled: false }),
    true
  )
  assert.equal(
    isClickerAdminAllowed({ nodeEnv: "development", hostname: "::1", search: "", enabled: false }),
    true
  )
})

test("clicker admin gate allows dev ?admin=1 for local playtest", () => {
  assert.equal(
    isClickerAdminAllowed({ nodeEnv: "development", hostname: "192.168.0.42", search: "?admin=1", enabled: false }),
    true
  )
  assert.equal(
    isClickerAdminAllowed({ nodeEnv: "development", hostname: "preview.vercel.app", search: "", enabled: false }),
    false
  )
})
