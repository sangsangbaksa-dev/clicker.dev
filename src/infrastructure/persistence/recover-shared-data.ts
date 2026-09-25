import type { Room, SchoolNotesDocument } from "@/domain/entities/board"
import type { StoredUser } from "@/domain/entities/user"
import { CLASSES } from "@/shared/classes"
import { saveMemberOrder } from "@/infrastructure/persistence/member-order"
import { loadMemberRoster } from "@/infrastructure/persistence/member-roster"
import { loadDurableAccounts } from "@/infrastructure/persistence/member-accounts"
import {
  loadRoomDirectory,
  saveRoomDirectory,
} from "@/infrastructure/persistence/room-directory"
import { loadTaskLedger, persistTaskLedgerFromRooms } from "@/infrastructure/persistence/task-ledger"
import { applyLedgerToRooms } from "@/domain/services/task-ledger"
import { runtimeGet } from "@/infrastructure/persistence/runtime-json-store"
import { saveSchoolNotes } from "@/infrastructure/persistence/school-notes-repository"
import {
  listSharedBlobs,
  readBlobPathname,
  type SharedBlobInfo,
} from "@/infrastructure/persistence/shared-json-store"
import {
  applyUserTombstones,
  keepKnownRooms,
  keepKnownUsers,
  mergeMemberOrder,
  mergeRoomDirectories,
  preferSchoolNotes,
  unionUserDirectories,
  userDirectorySize,
  type MemberOrderDocument,
  type RoomDirectory,
  type UserDirectory,
} from "@/infrastructure/persistence/shared-merge"
import {
  loadUserDirectory,
  saveUserDirectory,
} from "@/infrastructure/persistence/user-directory"
import { loadUserTombstones } from "@/infrastructure/persistence/user-tombstones"
import { listRemovedLoginIds } from "@/infrastructure/persistence/removed-accounts"
import { toPublicUser } from "@/infrastructure/persistence/user-repository"
import { isWaldoAccount } from "@/domain/services/access-level"

export type RecoveredMember = {
  id: string
  loginId: string
  name: string
  status: string
  classN?: number
}

export type RecoverSharedResult = {
  beforeCount: number
  afterCount: number
  restored: RecoveredMember[]
  blobCount: number
  blobPaths: string[]
  roomsRestored: number
  notesRestored: boolean
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asStoredUser(value: unknown): StoredUser | null {
  const row = asRecord(value)
  if (!row) return null
  if (typeof row.id !== "string" || !row.id) return null
  if (typeof row.loginId !== "string" || !row.loginId) return null
  if (typeof row.name !== "string" || !row.name) return null
  if (typeof row.passwordHash !== "string" || !row.passwordHash) return null
  if (typeof row.createdAt !== "string" || !row.createdAt) return null
  return value as StoredUser
}

function asUserDirectory(value: unknown): UserDirectory | null {
  const row = asRecord(value)
  if (!row) return null
  const users: Record<string, StoredUser> = {}
  const rawUsers = asRecord(row.users)
  if (rawUsers) {
    for (const user of Object.values(rawUsers)) {
      const parsed = asStoredUser(user)
      if (parsed) users[parsed.id] = parsed
    }
  }
  const pending = Array.isArray(row.pending)
    ? row.pending.map(asStoredUser).filter((user): user is StoredUser => Boolean(user))
    : []
  const index: Record<string, string> = {}
  const rawIndex = asRecord(row.index)
  if (rawIndex) {
    for (const [loginId, userId] of Object.entries(rawIndex)) {
      if (typeof userId === "string" && userId) index[loginId] = userId
    }
  }
  if (Object.keys(users).length === 0 && pending.length === 0 && Object.keys(index).length === 0) {
    return null
  }
  return {
    index,
    users,
    pending,
    deletedIds: Array.isArray(row.deletedIds)
      ? row.deletedIds.filter((id): id is string => typeof id === "string" && Boolean(id))
      : [],
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : "",
  }
}

function asUserIndex(value: unknown): Record<string, string> | null {
  const row = asRecord(value)
  if (!row) return null
  const index: Record<string, string> = {}
  for (const [loginId, userId] of Object.entries(row)) {
    if (typeof userId !== "string" || !userId.startsWith("usr_")) return null
    if (!loginId) return null
    index[loginId] = userId
  }
  return Object.keys(index).length > 0 ? index : null
}

function asRoomDirectory(value: unknown): RoomDirectory | null {
  const row = asRecord(value)
  if (!row) return null
  const rawRooms = asRecord(row.rooms)
  if (!rawRooms) {
    if (typeof row.code === "string") {
      const room = value as Room
      return { rooms: { [room.code]: room }, updatedAt: String(row.updatedAt ?? "") }
    }
    return null
  }
  const rooms: Record<string, Room> = {}
  for (const [code, room] of Object.entries(rawRooms)) {
    const parsed = asRecord(room)
    if (!parsed || typeof parsed.code !== "string") continue
    rooms[code] = room as Room
  }
  if (Object.keys(rooms).length === 0) return null
  return {
    rooms,
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : "",
  }
}

function asMemberOrder(value: unknown): MemberOrderDocument | null {
  const row = asRecord(value)
  if (!row || !Array.isArray(row.order)) return null
  const order = row.order.filter((id): id is string => typeof id === "string" && Boolean(id))
  if (order.length === 0) return null
  return { order, updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : "" }
}

function asSchoolNotes(value: unknown): SchoolNotesDocument | null {
  const row = asRecord(value)
  if (!row || !asRecord(row.notes) || typeof row.revision !== "number") return null
  return value as SchoolNotesDocument
}

function collectUserIds(dir: UserDirectory, rooms: RoomDirectory, order: string[]): Set<string> {
  const ids = new Set<string>([
    ...Object.keys(dir.users),
    ...Object.values(dir.index),
    ...order,
  ])
  for (const room of Object.values(rooms.rooms)) {
    for (const member of room.members ?? []) {
      if (member?.id) ids.add(member.id)
    }
    for (const group of room.groups ?? []) {
      for (const id of group.memberIds ?? []) {
        if (id) ids.add(id)
      }
    }
  }
  return ids
}

async function hydrateUsersByIds(ids: Iterable<string>): Promise<Record<string, StoredUser>> {
  const users: Record<string, StoredUser> = {}
  await Promise.all(
    [...ids].map(async (id) => {
      const cached = await runtimeGet<StoredUser>(`user:${id}`)
      const parsed = asStoredUser(cached)
      if (parsed) users[parsed.id] = parsed
    })
  )
  return users
}

function publicMembers(dir: UserDirectory): RecoveredMember[] {
  return Object.values(dir.users)
    .map((user) => {
      const pub = toPublicUser(user)
      return {
        id: pub.id,
        loginId: pub.loginId,
        name: pub.name,
        status: pub.status,
        classN: pub.classN,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ko"))
}

export async function recoverSharedSchoolData(): Promise<RecoverSharedResult> {
  const before = await loadUserDirectory({ fresh: true })
  const beforeCount = userDirectorySize(before)

  const blobs: SharedBlobInfo[] = await listSharedBlobs("hsms-md/")
  const [tombstones, expelledLoginIds] = await Promise.all([
    loadUserTombstones(),
    listRemovedLoginIds("expelled"),
  ])
  const liveTombstones = [...new Set([...before.deletedIds, ...tombstones])]
  const userDirs: UserDirectory[] = [before]
  const roster = await loadMemberRoster()
  if (Object.keys(roster.users).length > 0) {
    userDirs.push({
      index: {},
      users: roster.users,
      pending: [],
      deletedIds: [],
      updatedAt: roster.updatedAt,
    })
  }
  const durable = await loadDurableAccounts({ listBlobs: true })
  if (Object.keys(durable.users).length > 0) {
    userDirs.push({
      index: {},
      users: durable.users,
      pending: [],
      deletedIds: [],
      updatedAt: durable.updatedAt,
    })
  }
  const roomDirs: RoomDirectory[] = []
  const orders: MemberOrderDocument[] = []
  const notes: SchoolNotesDocument[] = []

  const runtimeDir = asUserDirectory(await runtimeGet("user-directory"))
  if (runtimeDir) userDirs.push(runtimeDir)
  const runtimeIndex = asUserIndex(await runtimeGet("users-index"))
  if (runtimeIndex) {
    userDirs.push({
      index: runtimeIndex,
      users: {},
      pending: [],
      deletedIds: [],
      updatedAt: "",
    })
  }
  const runtimePending = await runtimeGet<StoredUser[]>("pending-signups")
  if (Array.isArray(runtimePending)) {
    const users: Record<string, StoredUser> = {}
    for (const user of runtimePending) {
      const parsed = asStoredUser(user)
      if (parsed) users[parsed.id] = parsed
    }
    userDirs.push({
      index: {},
      users,
      pending: Object.values(users),
      deletedIds: [],
      updatedAt: "",
    })
  }
  const runtimeRooms = asRoomDirectory(await runtimeGet("room-directory"))
  if (runtimeRooms) roomDirs.push(runtimeRooms)
  const runtimeOrder = asMemberOrder(await runtimeGet("member-order"))
  if (runtimeOrder) orders.push(runtimeOrder)
  const runtimeNotes = asSchoolNotes(await runtimeGet("school-notes"))
  if (runtimeNotes) notes.push(runtimeNotes)

  for (const info of CLASSES) {
    const room = await runtimeGet<Room>(`room:${info.code}`)
    if (room?.code) {
      roomDirs.push({ rooms: { [room.code]: room }, updatedAt: "" })
    }
  }

  for (const blob of blobs) {
    if (!blob.pathname.endsWith(".json")) continue
    const value = await readBlobPathname<unknown>(blob.pathname)
    const dir = asUserDirectory(value)
    if (dir) {
      userDirs.push(dir)
      continue
    }
    const storedUser = asStoredUser(value)
    if (storedUser) {
      userDirs.push({
        index: {},
        users: { [storedUser.id]: storedUser },
        pending: storedUser.status === "pending" ? [storedUser] : [],
        deletedIds: [],
        updatedAt: "",
      })
      continue
    }
    const index = asUserIndex(value)
    if (index) {
      userDirs.push({
        index,
        users: {},
        pending: [],
        deletedIds: [],
        updatedAt: "",
      })
      continue
    }
    const rooms = asRoomDirectory(value)
    if (rooms) {
      roomDirs.push(rooms)
      continue
    }
    const order = asMemberOrder(value)
    if (order) {
      orders.push(order)
      continue
    }
    const school = asSchoolNotes(value)
    if (school) notes.push(school)
  }

  let rooms = mergeRoomDirectories(roomDirs)
  let merged = applyUserTombstones(unionUserDirectories(userDirs), liveTombstones)
  const expelled = new Set(
    Object.values(merged.users)
      .filter(
        (user) =>
          expelledLoginIds.has(user.loginId.trim().toLowerCase()) &&
          !isWaldoAccount(user.loginId)
      )
      .map((user) => user.id)
  )
  merged = applyUserTombstones(merged, expelled)
  const orderDoc = mergeMemberOrder(orders)
  const extraUsers = await hydrateUsersByIds(
    collectUserIds(merged, rooms, orderDoc.order)
  )
  merged = applyUserTombstones(
    unionUserDirectories([
      merged,
      {
        index: {},
        users: extraUsers,
        pending: [],
        deletedIds: [],
        updatedAt: "",
      },
    ]),
    [
      ...liveTombstones,
      ...expelled,
      ...Object.values(extraUsers)
        .filter(
          (user) =>
            expelledLoginIds.has(user.loginId.trim().toLowerCase()) &&
            !isWaldoAccount(user.loginId)
        )
        .map((user) => user.id),
    ]
  )
  merged = applyUserTombstones(keepKnownUsers(before, merged), [...liveTombstones, ...expelled])

  if (userDirectorySize(merged) > beforeCount) {
    merged = await saveUserDirectory(merged)
  }

  const currentRooms = await loadRoomDirectory({ fresh: true })
  rooms = keepKnownRooms(currentRooms.dir, mergeRoomDirectories([currentRooms.dir, rooms]))
  const taskLedger = await loadTaskLedger()
  rooms = { ...rooms, rooms: applyLedgerToRooms(rooms.rooms, taskLedger) }
  let roomsRestored = 0
  for (const [code, room] of Object.entries(rooms.rooms)) {
    const current = currentRooms.dir.rooms[code]
    if (
      !current ||
      room.revision > current.revision ||
      (room.members?.length ?? 0) > (current.members?.length ?? 0) ||
      (room.tasks?.length ?? 0) > (current.tasks?.length ?? 0)
    ) {
      roomsRestored += 1
    }
  }
  if (roomsRestored > 0 && Object.keys(rooms.rooms).length > 0) {
    rooms = await saveRoomDirectory(rooms)
  } else {
    roomsRestored = 0
    await persistTaskLedgerFromRooms(rooms.rooms)
  }

  if (orderDoc.order.length > 0) {
    await saveMemberOrder(orderDoc.order)
  }

  let notesRestored = false
  if (notes.length > 0) {
    const best = preferSchoolNotes(notes, notes[0])
    if ((best.revision ?? 0) > 1 || Object.values(best.notes ?? {}).some((text) => String(text ?? "").trim())) {
      await saveSchoolNotes(best)
      notesRestored = true
    }
  }

  const after = await loadUserDirectory({ fresh: true })
  const beforeIds = new Set(Object.keys(before.users))
  const restored = publicMembers(after).filter((member) => !beforeIds.has(member.id))

  return {
    beforeCount,
    afterCount: userDirectorySize(after),
    restored,
    blobCount: blobs.length,
    blobPaths: blobs.map((blob) => blob.pathname).slice(0, 80),
    roomsRestored,
    notesRestored,
  }
}
