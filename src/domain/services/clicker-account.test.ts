import assert from "node:assert/strict"
import test from "node:test"
import { CLOUD_SAVE_MAX_BYTES, cloudSaveError, normalizeLoginId, saveProgress, shouldReplaceCloudSave, signupError } from "./clicker-account.ts"

const ok = { loginId: "Miner_01", nickname: "광부", password: "secret1", passwordConfirm: "secret1" }

test("signup validation", () => {
  assert.equal(signupError(ok), null)
  assert.equal(normalizeLoginId(" Miner_01 "), "miner_01")
  assert.ok(signupError({ ...ok, loginId: "ab" }))
  assert.ok(signupError({ ...ok, loginId: "한글아이디" }))
  assert.ok(signupError({ ...ok, nickname: " " }))
  assert.ok(signupError({ ...ok, nickname: "가".repeat(13) }))
  assert.ok(signupError({ ...ok, password: "12345", passwordConfirm: "12345" }))
  assert.ok(signupError({ ...ok, passwordConfirm: "other1" }))
})

test("cloud save validation", () => {
  assert.equal(cloudSaveError(JSON.stringify({ version: 1 })), null)
  assert.ok(cloudSaveError(""))
  assert.ok(cloudSaveError("not json"))
  assert.ok(cloudSaveError("[1,2]"))
  assert.ok(cloudSaveError(JSON.stringify({ pad: "x".repeat(CLOUD_SAVE_MAX_BYTES) })))
})

test("cloud saves: the run with the most total CORE is kept", () => {
  const save = (total: number) => JSON.stringify({ metaState: { totalCoreEnergy: total } })
  assert.equal(saveProgress(save(5e9)), 5e9)
  assert.equal(saveProgress("not json"), 0)
  assert.equal(shouldReplaceCloudSave(null, save(1)), true)
  assert.equal(shouldReplaceCloudSave(save(5e9), save(2e3)), false, "a reset or fresh run never replaces a further one")
  assert.equal(shouldReplaceCloudSave(save(5e9), save(6e9)), true)
  assert.equal(shouldReplaceCloudSave(save(5e9), save(5e9)), true, "a tie keeps the newer upload")
})
