import assert from "node:assert/strict"
import test from "node:test"
import type { ClickerStoredAccount } from "./clicker-account.ts"
import { mergeClickerAccountBooks } from "./clicker-account-book.ts"

const row = (loginId: string): ClickerStoredAccount => ({
  id: "1",
  loginId,
  nickname: "n",
  passwordHash: "$2b$10$abcdefghijklmnopqrstuu",
  createdAt: "2026-01-01T00:00:00.000Z",
})

test("merge keeps existing ids and adds new ones", () => {
  const r = mergeClickerAccountBooks({ alice: row("alice") }, { bob: row("bob"), alice: row("alice") })
  assert.equal(r.added, 1)
  assert.equal(r.skipped, 1)
  assert.ok(r.book.bob)
  assert.equal(r.book.alice.nickname, "n")
})

test("merge rejects invalid password hashes", () => {
  const bad = { ...row("bob"), passwordHash: "plain" }
  const r = mergeClickerAccountBooks({}, { bob: bad })
  assert.equal(r.added, 0)
  assert.equal(Object.keys(r.book).length, 0)
})
