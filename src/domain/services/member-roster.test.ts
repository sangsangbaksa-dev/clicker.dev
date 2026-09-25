import assert from "node:assert/strict"
import test from "node:test"
import type { StoredUser } from "../entities/user.ts"
import {
  dropRosterMembers,
  mergeAccountIds,
  mergeMemberRosters,
  reviveUsersFromRoster,
  rosterFromUsers,
} from "./member-roster.ts"

function user(id: string, loginId: string, name: string, status: "approved" | "pending" = "approved"): StoredUser {
  return {
    id,
    loginId,
    name,
    passwordHash: "hash",
    status,
    createdAt: "2026-09-01T00:00:00.000Z",
  }
}

test("member roster is append-only across a sparse overwrite", () => {
  const roster = rosterFromUsers(
    {
      usr_a: user("usr_a", "jaeryeong", "이재령"),
      usr_b: user("usr_b", "jiin", "권지인"),
    },
    "1"
  )
  const sparse = rosterFromUsers(
    { usr_w: user("usr_w", "waldo", "이찬형") },
    "2"
  )
  const merged = mergeMemberRosters([sparse, roster])
  assert.equal(merged.users.usr_a?.name, "이재령")
  assert.equal(merged.users.usr_b?.name, "권지인")
  assert.equal(merged.users.usr_w?.name, "이찬형")
})

test("only explicit 퇴출 removes a name from the roster", () => {
  const roster = rosterFromUsers(
    {
      usr_a: user("usr_a", "jaeryeong", "이재령"),
      usr_b: user("usr_b", "jiin", "권지인"),
    },
    "1"
  )
  const next = dropRosterMembers(roster, ["usr_a"])
  assert.equal(next.users.usr_a, undefined)
  assert.equal(next.users.usr_b?.name, "권지인")
  assert.deepEqual(next.deletedIds, ["usr_a"])
})

test("bundled roster cannot revive a tombstoned 퇴출 account", () => {
  const roster = dropRosterMembers(
    rosterFromUsers(
      {
        usr_a: user("usr_a", "Waldo2", "이찬영"),
        usr_w: user("usr_w", "waldo", "이찬형"),
      },
      "1"
    ),
    ["usr_a"]
  )
  const revived = reviveUsersFromRoster(
    { usr_w: user("usr_w", "waldo", "이찬형") },
    ["usr_a"],
    roster
  )
  assert.equal(revived.users.usr_a, undefined)
  assert.equal(revived.users.usr_w?.name, "이찬형")
  assert.deepEqual(revived.deletedIds, ["usr_a"])
})

test("directory tombstone wins over a stale roster copy of Waldo2", () => {
  const roster = rosterFromUsers(
    {
      usr_a: user("usr_a", "Waldo2", "이찬영"),
      usr_w: user("usr_w", "waldo", "이찬형"),
    },
    "1"
  )
  const revived = reviveUsersFromRoster(
    { usr_w: user("usr_w", "waldo", "이찬형") },
    ["usr_a"],
    roster
  )
  assert.equal(revived.users.usr_a, undefined)
  assert.deepEqual(revived.deletedIds, ["usr_a"])
})

test("a sparse directory without tombstones still restores roster accounts", () => {
  const roster = rosterFromUsers(
    {
      usr_a: user("usr_a", "jaeryeong", "이재령"),
      usr_w: user("usr_w", "waldo", "이찬형"),
    },
    "1"
  )
  const revived = reviveUsersFromRoster(
    { usr_w: user("usr_w", "waldo", "이찬형") },
    [],
    roster
  )
  assert.equal(revived.users.usr_a?.name, "이재령")
  assert.deepEqual(revived.deletedIds, [])
})

test("퇴출된 아이디는 명단에 없으면 복구하지 않는다", () => {
  const roster = rosterFromUsers(
    { usr_w: user("usr_w", "waldo", "이찬형") },
    "1"
  )
  const revived = reviveUsersFromRoster({}, ["usr_gone"], roster)
  assert.equal(revived.users.usr_gone, undefined)
  assert.deepEqual(revived.deletedIds, ["usr_gone"])
})

test("account id list is append-only across a sparse deploy overwrite", () => {
  const merged = mergeAccountIds([
    { ids: ["usr_w"], deletedIds: [], updatedAt: "2" },
    { ids: ["usr_a", "usr_b", "usr_w"], deletedIds: [], updatedAt: "1" },
  ])
  assert.deepEqual(merged.ids, ["usr_w", "usr_a", "usr_b"])
  assert.deepEqual(merged.deletedIds, [])
})

test("empty account id list cannot wipe known ids", () => {
  const merged = mergeAccountIds([
    { ids: [], deletedIds: [], updatedAt: "9" },
    ["usr_a", "usr_b"],
  ])
  assert.deepEqual(merged.ids, ["usr_a", "usr_b"])
})

test("퇴출된 아이디만 account id list에서 빠진다", () => {
  const merged = mergeAccountIds(
    [
      { ids: ["usr_a", "usr_b", "usr_w"], deletedIds: [], updatedAt: "1" },
      { ids: ["usr_w"], deletedIds: [], updatedAt: "2" },
    ],
    ["usr_a"]
  )
  assert.deepEqual(merged.ids, ["usr_b", "usr_w"])
  assert.deepEqual(merged.deletedIds, ["usr_a"])
})

test("stored account tombstones survive a sparse id list overwrite", () => {
  const merged = mergeAccountIds([
    { ids: ["usr_w"], deletedIds: [], updatedAt: "2" },
    { ids: ["usr_a", "usr_w"], deletedIds: ["usr_a"], updatedAt: "1" },
  ])
  assert.deepEqual(merged.ids, ["usr_w"])
  assert.deepEqual(merged.deletedIds, ["usr_a"])
})
