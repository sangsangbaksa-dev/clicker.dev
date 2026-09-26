import assert from "node:assert/strict"
import test from "node:test"
import { nicknameError, nicknameKey, normalizeNickname, passwordError } from "./clicker-account.ts"

test("nicknames: Korean and ASCII allowed, length and symbols checked", () => {
  assert.equal(nicknameError("루마"), undefined)
  assert.equal(nicknameError("miner_01"), undefined)
  assert.ok(nicknameError("a"))
  assert.ok(nicknameError("x".repeat(17)))
  assert.ok(nicknameError("no spaces"))
  assert.ok(nicknameError("<script>"))
})

test("nickname lookup ignores case, width and surrounding space", () => {
  assert.equal(normalizeNickname(" Luma "), "luma")
  assert.equal(nicknameKey("LUMA"), nicknameKey("luma"))
  assert.equal(nicknameKey("ＬＵＭＡ"), nicknameKey("luma"))
  assert.match(nicknameKey("루마"), /^[0-9a-f]+$/)
})

test("passwords need 6+ chars and fit bcrypt", () => {
  assert.ok(passwordError("12345"))
  assert.equal(passwordError("123456"), undefined)
  assert.ok(passwordError("가".repeat(30)))
})
