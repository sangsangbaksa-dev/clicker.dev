import assert from "node:assert/strict"
import test from "node:test"
import { selectUsersToPurge, shouldPurgeStoredUser } from "./member-purge.ts"

test("only exact waldo is protected from purge", () => {
  assert.equal(shouldPurgeStoredUser({ loginId: "Waldo" }), false)
  assert.equal(shouldPurgeStoredUser({ loginId: "waldo" }), false)
  assert.equal(shouldPurgeStoredUser({ loginId: " WALDO " }), false)
  assert.equal(shouldPurgeStoredUser({ loginId: "Waldo2" }), true)
  assert.equal(shouldPurgeStoredUser({ loginId: "waldo2" }), true)
  assert.equal(shouldPurgeStoredUser({ loginId: "notwaldo" }), true)
})

test("purge keeps the owner and drops Waldo2 plus other members", () => {
  const removed = selectUsersToPurge([
    { loginId: "Waldo", name: "이찬형" },
    { loginId: "Waldo2", name: "이찬영" },
    { loginId: "jaeryeong", name: "이재령" },
  ])
  assert.deepEqual(
    removed.map((user) => user.loginId),
    ["Waldo2", "jaeryeong"]
  )
})
