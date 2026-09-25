import assert from "node:assert/strict"
import test from "node:test"
import type { Room } from "../../domain/entities/board.ts"
import {
  applyUserTombstones,
  keepKnownRooms,
  keepKnownUsers,
  keepRicherSchoolNotes,
  layersAreConfirmedEmpty,
  mergeRoomDirectories,
  mergeUserDirectories,
  unionUserDirectories,
} from "./shared-merge.ts"

function room(code: string, revision: number): Room {
  return {
    code,
    title: code,
    subject: "",
    description: "",
    deadline: "",
    createdBy: "u",
    createdAt: "1",
    updatedAt: String(revision),
    revision,
    notes: "",
    members: [],
    tasks: [],
    updates: [],
  }
}

test("keepKnownRooms restores a class dropped from a partial directory write", () => {
  const previous = mergeRoomDirectories([
    { rooms: { BAN1: room("BAN1", 4), BAN2: room("BAN2", 9) }, updatedAt: "2" },
  ])
  const next = mergeRoomDirectories([
    { rooms: { BAN1: room("BAN1", 5) }, updatedAt: "3" },
  ])
  const kept = keepKnownRooms(previous, next)
  assert.equal(kept.rooms.BAN1?.revision, 5)
  assert.equal(kept.rooms.BAN2?.revision, 9)
})

test("keepRicherSchoolNotes refuses a blank overwrite", () => {
  const current = {
    notes: { english_s: "수행 안내" },
    revision: 8,
    createdAt: "1",
    updatedAt: "8",
    notesHistory: [{ id: "n1" }],
  }
  const blank = {
    notes: { english_s: "" },
    revision: 1,
    createdAt: "9",
    updatedAt: "9",
    notesHistory: [],
  }
  const kept = keepRicherSchoolNotes(current as never, blank as never)
  assert.equal(kept.revision, 8)
  assert.equal((kept.notes as { english_s?: string }).english_s, "수행 안내")
})

test("blob skip is not a confirmed empty school", () => {
  assert.equal(
    layersAreConfirmedEmpty({
      unreliable: false,
      blobStatus: "skip",
      cacheStatus: "miss",
      file: null,
      snapshot: null,
    }),
    false
  )
})

test("blob miss plus cache miss is confirmed empty", () => {
  assert.equal(
    layersAreConfirmedEmpty({
      unreliable: false,
      blobStatus: "miss",
      cacheStatus: "miss",
      file: null,
      snapshot: null,
    }),
    true
  )
})

test("applyUserTombstones drops Waldo2 after a recovery union", () => {
  const live = {
    index: { waldo: "usr_w" },
    users: { usr_w: user("usr_w", "waldo", "이찬형") },
    pending: [],
    deletedIds: ["usr_a"],
    updatedAt: "2",
  }
  const backup = {
    index: { waldo: "usr_w", waldo2: "usr_a" },
    users: {
      usr_w: user("usr_w", "waldo", "이찬형"),
      usr_a: user("usr_a", "Waldo2", "이찬영"),
    },
    pending: [],
    deletedIds: [],
    updatedAt: "1",
  }
  const merged = applyUserTombstones(unionUserDirectories([live, backup]), live.deletedIds)
  assert.equal(merged.users.usr_a, undefined)
  assert.equal(merged.users.usr_w?.name, "이찬형")
  assert.deepEqual(merged.deletedIds, ["usr_a"])
})

test("keepKnownUsers does not restore a tombstoned member", () => {
  const previous = mergeUserDirectories([
    {
      index: { waldo: "usr_w", waldo2: "usr_a" },
      users: {
        usr_w: user("usr_w", "waldo", "이찬형"),
        usr_a: user("usr_a", "Waldo2", "이찬영"),
      },
      pending: [],
      deletedIds: [],
      updatedAt: "1",
    },
  ])
  const next = mergeUserDirectories([
    {
      index: { waldo: "usr_w" },
      users: { usr_w: user("usr_w", "waldo", "이찬형") },
      pending: [],
      deletedIds: ["usr_a"],
      updatedAt: "2",
    },
  ])
  const kept = keepKnownUsers(previous, next)
  assert.equal(kept.users.usr_a, undefined)
  assert.deepEqual(kept.deletedIds, ["usr_a"])
})

test("unionUserDirectories restores members a tombstone list would drop", () => {
  const full = {
    index: { jaeryeong: "usr_a", jiin: "usr_b" },
    users: {
      usr_a: user("usr_a", "jaeryeong", "이재령"),
      usr_b: user("usr_b", "jiin", "권지인"),
    },
    pending: [],
    deletedIds: [],
    updatedAt: "1",
  }
  const sparse = {
    index: { waldo: "usr_w" },
    users: { usr_w: user("usr_w", "waldo", "이찬형") },
    pending: [],
    deletedIds: ["usr_a", "usr_b"],
    updatedAt: "2",
  }
  const merged = unionUserDirectories([sparse, full])
  assert.equal(merged.users.usr_a?.name, "이재령")
  assert.equal(merged.users.usr_b?.name, "권지인")
  assert.equal(merged.users.usr_w?.name, "이찬형")
  assert.deepEqual(merged.deletedIds, [])
})

function user(id: string, loginId: string, name: string) {
  return {
    id,
    loginId,
    name,
    passwordHash: "x",
    status: "approved" as const,
    createdAt: "1",
  }
}
