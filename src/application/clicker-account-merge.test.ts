import assert from "node:assert/strict"
import test from "node:test"
import { mergeImportedClickerAccounts } from "./clicker-account-merge.ts"

const hash = "$2b$10$abcdefghijklmnopqrstuu"

test("mergeImportedClickerAccounts persists new rows only", async () => {
  let book: Record<string, unknown> = { alice: { id: "1", loginId: "alice", nickname: "A", passwordHash: hash, createdAt: "t" } }
  const ports = {
    loadBook: async () => book as never,
    saveBook: async (next: never) => {
      book = next as Record<string, unknown>
    },
  }
  const r = await mergeImportedClickerAccounts(ports, {
    bob: { id: "2", loginId: "bob", nickname: "B", passwordHash: hash, createdAt: "t" },
    alice: { id: "9", loginId: "alice", nickname: "X", passwordHash: hash, createdAt: "t" },
  })
  assert.ok(r.ok)
  assert.equal(r.ok && r.value.added, 1)
  assert.equal(r.ok && r.value.skipped, 1)
  assert.ok(book.bob)
})
