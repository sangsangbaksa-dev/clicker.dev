import assert from "node:assert/strict"
import test from "node:test"
import { compareSaveAge, safeSignInUrl } from "./clicker-cloud-save.ts"

test("compareSaveAge", () => {
  assert.equal(compareSaveAge(100, 200), "cloud-newer")
  assert.equal(compareSaveAge(200, 100), "local-newer")
  assert.equal(compareSaveAge(100, 100), "same")
  assert.equal(compareSaveAge(0, 100), "unknown")
  assert.equal(compareSaveAge(NaN, 100), "unknown")
})

test("sign-in link must be a same-origin path", () => {
  assert.equal(safeSignInUrl("/api/auth/google/start?next=%2F"), "/api/auth/google/start?next=%2F")
  for (const bad of ["https://evil.example/x", "//evil.example", "javascript:alert(1)", "", null, 5, "/a b", "/a\nb"]) {
    assert.equal(safeSignInUrl(bad), null, String(bad))
  }
})
