import assert from "node:assert/strict"
import test from "node:test"
import { normalizeLoginId, validateSignup } from "./clicker-account.ts"

const ok = { loginId: "Miner_01", nickname: "광부", password: "secret1", passwordConfirm: "secret1" }

test("valid signup passes and login ids are lowercased", () => {
  assert.equal(validateSignup(ok), null)
  assert.equal(normalizeLoginId(" Miner_01 "), "miner_01")
})

test("rejects bad id, nickname, short password and mismatched confirm", () => {
  assert.ok(validateSignup({ ...ok, loginId: "ab" }))
  assert.ok(validateSignup({ ...ok, loginId: "한글아이디" }))
  assert.ok(validateSignup({ ...ok, nickname: "  " }))
  assert.ok(validateSignup({ ...ok, nickname: "가".repeat(13) }))
  assert.ok(validateSignup({ ...ok, password: "123", passwordConfirm: "123" }))
  assert.ok(validateSignup({ ...ok, passwordConfirm: "other" }))
})
