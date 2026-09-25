/**
 * Serverless merge contract: two function instances must not drop each
 * other's users/rooms, and a failed shared GET must not save defaults.
 * Run: node scripts/test-serverless-merge.mjs
 */

function preferNewerUser(a, b) {
  if (a.status === "approved" && b.status !== "approved") return a
  if (b.status === "approved" && a.status !== "approved") return b
  const aTime = a.approvedAt ?? a.createdAt
  const bTime = b.approvedAt ?? b.createdAt
  return bTime >= aTime ? b : a
}

function mergeUserDirectories(dirs) {
  const deleted = new Set()
  for (const dir of dirs) {
    for (const id of dir?.deletedIds ?? []) deleted.add(id)
  }
  const users = {}
  for (const dir of dirs) {
    if (!dir) continue
    for (const user of Object.values(dir.users ?? {})) {
      if (!user?.id || deleted.has(user.id)) continue
      users[user.id] = users[user.id] ? preferNewerUser(users[user.id], user) : user
    }
    for (const user of dir.pending ?? []) {
      if (!user?.id || deleted.has(user.id)) continue
      users[user.id] = users[user.id] ? preferNewerUser(users[user.id], user) : user
    }
  }
  const index = {}
  for (const user of Object.values(users)) {
    index[user.loginId.trim().toLowerCase()] = user.id
  }
  return {
    index,
    users,
    pending: Object.values(users).filter((user) => user.status === "pending"),
    deletedIds: [...deleted].sort(),
    updatedAt: "",
  }
}

function keepKnownUsers(previous, next) {
  const deleted = new Set(next.deletedIds)
  const restored = { ...next.users }
  for (const [id, user] of Object.entries(previous.users)) {
    if (!deleted.has(id) && !restored[id]) restored[id] = user
  }
  return mergeUserDirectories([{ ...next, users: restored }])
}

function mergeRoomDirectories(dirs) {
  const rooms = {}
  for (const dir of dirs) {
    for (const room of Object.values(dir?.rooms ?? {})) {
      if (!room?.code) continue
      const current = rooms[room.code]
      if (!current || room.revision > current.revision) rooms[room.code] = room
      else if (room.revision === current.revision && room.updatedAt >= current.updatedAt) {
        rooms[room.code] = room
      }
    }
  }
  return { rooms, updatedAt: "" }
}

function pruneMembersByTombstone(members, deletedIds) {
  const deleted = new Set(deletedIds)
  return members.filter((member) => !deleted.has(member.id))
}

function preferSchoolNotes(docs, fallback) {
  let best = null
  for (const doc of docs) {
    if (!doc) continue
    if (!best || doc.revision > best.revision) best = doc
    else if (doc.revision === best.revision && doc.updatedAt >= best.updatedAt) best = doc
  }
  return best ?? fallback
}

const userA = {
  id: "usr_a",
  loginId: "mina",
  status: "pending",
  createdAt: "2026-09-14T01:00:00.000Z",
}
const userB = {
  id: "usr_b",
  loginId: "jun",
  status: "pending",
  createdAt: "2026-09-14T01:00:01.000Z",
}

const instanceA = {
  index: { mina: "usr_a" },
  users: { usr_a: userA },
  pending: [userA],
  deletedIds: [],
}
const instanceB = {
  index: { jun: "usr_b" },
  users: { usr_b: userB },
  pending: [userB],
  deletedIds: [],
}

let failed = 0
function check(label, ok) {
  console.log(`${ok ? "PASS" : "FAIL"} | ${label}`)
  if (!ok) failed += 1
}

const mergedUsers = mergeUserDirectories([instanceA, instanceB])
check("two instances keep both signups", Boolean(mergedUsers.users.usr_a && mergedUsers.users.usr_b))
check("pending list has both applicants", mergedUsers.pending.length === 2)

const wiped = mergeUserDirectories([instanceB])
const restored = keepKnownUsers(instanceA, wiped)
check("failed GET does not drop known users", Boolean(restored.users.usr_a && restored.users.usr_b))

const approved = mergeUserDirectories([
  instanceA,
  {
    ...instanceA,
    users: { usr_a: { ...userA, status: "approved", approvedAt: "2026-09-14T02:00:00.000Z" } },
    pending: [],
  },
])
check("approved status wins over pending copy", approved.users.usr_a.status === "approved")
check("approved user leaves pending list", approved.pending.length === 0)

const afterReject = mergeUserDirectories([
  mergedUsers,
  { index: {}, users: {}, pending: [], deletedIds: ["usr_b"] },
])
check("tombstone removes rejected signup", !afterReject.users.usr_b && afterReject.pending.length === 1)

const rooms = mergeRoomDirectories([
  { rooms: { BAN1: { code: "BAN1", revision: 8, updatedAt: "2026-09-14T03:00:00.000Z", notes: "실데이터" } } },
  { rooms: { BAN1: { code: "BAN1", revision: 1, updatedAt: "2026-09-14T03:01:00.000Z", notes: "빈 템플릿" } } },
])
check("empty class template cannot overwrite a newer board", rooms.rooms.BAN1.notes === "실데이터")

const bothRooms = mergeRoomDirectories([
  { rooms: { BAN1: { code: "BAN1", revision: 4, updatedAt: "t1" } } },
  { rooms: { BAN2: { code: "BAN2", revision: 2, updatedAt: "t2" } } },
])
check("saving one class keeps the other class board", Boolean(bothRooms.rooms.BAN1 && bothRooms.rooms.BAN2))

const members = [
  { id: "usr_a", name: "민아" },
  { id: "usr_b", name: "준" },
]
const prunedMissing = pruneMembersByTombstone(members, [])
check("missing index must not strip members", prunedMissing.length === 2)
const prunedDeleted = pruneMembersByTombstone(members, ["usr_b"])
check("only tombstoned members are removed", prunedDeleted.length === 1 && prunedDeleted[0].id === "usr_a")

const notes = preferSchoolNotes(
  [
    { revision: 12, updatedAt: "2026-09-14T04:00:00.000Z", notes: { general: "전교" } },
    { revision: 1, updatedAt: "2026-09-14T04:05:00.000Z", notes: { general: "" } },
  ],
  { revision: 1, updatedAt: "", notes: { general: "" } }
)
check("default school notes cannot overwrite a higher revision", notes.revision === 12)

if (failed) process.exitCode = 1
