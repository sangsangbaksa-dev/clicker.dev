import assert from "node:assert/strict"
import test from "node:test"
import { isClickerAdminAllowed, isClickerAdminHost } from "./clicker-admin-gate.ts"

test("clicker admin host detects loopback names", () => {
  assert.equal(isClickerAdminHost("localhost"), true)
  assert.equal(isClickerAdminHost("127.0.0.1"), true)
  assert.equal(isClickerAdminHost("::1"), true)
  assert.equal(isClickerAdminHost("preview.vercel.app"), false)
})

test("clicker admin gate blocks production builds", () => {
  assert.equal(
    isClickerAdminAllowed({ nodeEnv: "production", hostname: "localhost", search: "" }),
    false
  )
  assert.equal(
    isClickerAdminAllowed({ nodeEnv: "production", hostname: "localhost", search: "?admin=1" }),
    false
  )
  assert.equal(
    isClickerAdminAllowed({ nodeEnv: "production", hostname: "preview.vercel.app", search: "?admin=1" }),
    false
  )
  assert.equal(
    isClickerAdminAllowed({ nodeEnv: "Production", hostname: "localhost", search: "?admin=1" }),
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
