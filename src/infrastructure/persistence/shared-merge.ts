import type { SchoolNotesDocument, Room } from "@/domain/entities/board"
import type { ProfileChangeRequest, StoredUser } from "@/domain/entities/user"

export type UserDirectory = {
  index: Record<string, string>
  users: Record<string, StoredUser>
  pending: StoredUser[]
  deletedIds: string[]
  updatedAt: string
}

export type RoomDirectory = {
  rooms: Record<string, Room>
  updatedAt: string
}

export type MemberOrderDocument = {
  order: string[]
  updatedAt: string
}

export type ProfileRequestDirectory = {
  requests: ProfileChangeRequest[]
  deletedIds: string[]
  updatedAt: string
}

export type RemovedAccountRecord = {
  loginId: string
  passwordHash: string
  reason: "expelled" | "rejected"
  removedAt: string
}

export function emptyUserDirectory(updatedAt = ""): UserDirectory {
  return { index: {}, users: {}, pending: [], deletedIds: [], updatedAt }
}

export function emptyRoomDirectory(updatedAt = ""): RoomDirectory {
  return { rooms: {}, updatedAt }
}

export function preferNewerUser(a: StoredUser, b: StoredUser): StoredUser {
  if (a.status === "approved" && b.status !== "approved") return a
  if (b.status === "approved" && a.status !== "approved") return b
  const aTime = a.approvedAt ?? a.createdAt
  const bTime = b.approvedAt ?? b.createdAt
  return bTime >= aTime ? b : a
}

export function mergePendingUsers(lists: Array<StoredUser[] | null | undefined>): StoredUser[] {
  const byId = new Map<string, StoredUser>()
  for (const list of lists) {
    if (!list) continue
    for (const user of list) {
      if (!user?.id) continue
      if (user.status === "pending") {
        const current = byId.get(user.id)
        byId.set(user.id, current ? preferNewerUser(current, user) : user)
      } else {
        byId.delete(user.id)
      }
    }
  }
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export function mergeUserDirectories(
  dirs: Array<UserDirectory | null | undefined>
): UserDirectory {
  const deleted = new Set<string>()
  for (const dir of dirs) {
    for (const id of dir?.deletedIds ?? []) {
      if (id) deleted.add(id)
    }
  }

  const users: Record<string, StoredUser> = {}
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

  const index: Record<string, string> = {}
  for (const dir of dirs) {
    if (!dir) continue
    for (const [loginId, userId] of Object.entries(dir.index ?? {})) {
      if (!loginId || !userId || deleted.has(userId) || !users[userId]) continue
      index[loginId] = userId
    }
  }
  for (const user of Object.values(users)) {
    const loginId = user.loginId.trim().toLowerCase()
    if (loginId) index[loginId] = user.id
  }
  for (const [loginId, userId] of Object.entries(index)) {
    if (deleted.has(userId) || !users[userId]) delete index[loginId]
  }

  let updatedAt = ""
  for (const dir of dirs) {
    const stamp = dir?.updatedAt ?? ""
    if (stamp > updatedAt) updatedAt = stamp
  }

  return {
    index,
    users,
    pending: Object.values(users)
      .filter((user) => user.status === "pending")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    deletedIds: [...deleted].sort(),
    updatedAt,
  }
}

/** True when next dropped a live user that previous still had. */
export function userDirectoryLostIds(previous: UserDirectory, next: UserDirectory): string[] {
  const deleted = new Set(next.deletedIds)
  return Object.keys(previous.users).filter(
    (id) => !deleted.has(id) && !next.users[id]
  )
}

export function keepKnownUsers(previous: UserDirectory, next: UserDirectory): UserDirectory {
  const lost = userDirectoryLostIds(previous, next)
  if (lost.length === 0) return next
  const restoredUsers = { ...next.users }
  const restoredIndex = { ...next.index }
  for (const id of lost) {
    const user = previous.users[id]
    if (!user) continue
    restoredUsers[id] = user
    const loginId = user.loginId.trim().toLowerCase()
    if (loginId) restoredIndex[loginId] = id
  }
  return mergeUserDirectories([
    { ...next, users: restoredUsers, index: restoredIndex },
  ])
}

/** Merge copies while restoring anyone a sparse tombstone list would drop. */
export function unionUserDirectories(
  dirs: Array<UserDirectory | null | undefined>
): UserDirectory {
  return mergeUserDirectories(
    dirs.filter((dir): dir is UserDirectory => Boolean(dir)).map((dir) => ({
      ...dir,
      deletedIds: [],
    }))
  )
}

/** Re-apply 퇴출 tombstones after a recovery union. */
export function applyUserTombstones(
  dir: UserDirectory,
  extraIds: Iterable<string> = []
): UserDirectory {
  return mergeUserDirectories([
    {
      ...dir,
      deletedIds: [...dir.deletedIds, ...extraIds],
    },
  ])
}

export function userDirectorySize(dir: UserDirectory | null | undefined): number {
  return Object.keys(dir?.users ?? {}).length
}

export function preferRoom(a: Room, b: Room): Room {
  if (b.revision !== a.revision) return b.revision > a.revision ? b : a
  return b.updatedAt >= a.updatedAt ? b : a
}

export function mergeRoomDirectories(
  dirs: Array<RoomDirectory | null | undefined>
): RoomDirectory {
  const rooms: Record<string, Room> = {}
  let updatedAt = ""
  for (const dir of dirs) {
    if (!dir) continue
    if (dir.updatedAt > updatedAt) updatedAt = dir.updatedAt
    for (const [code, room] of Object.entries(dir.rooms ?? {})) {
      if (!room?.code) continue
      rooms[code] = rooms[code] ? preferRoom(rooms[code], room) : room
    }
  }
  return { rooms, updatedAt }
}

/** True when next dropped a class board that previous still had. */
export function roomDirectoryLostCodes(
  previous: RoomDirectory,
  next: RoomDirectory
): string[] {
  return Object.keys(previous.rooms).filter((code) => !next.rooms[code])
}

export function keepKnownRooms(previous: RoomDirectory, next: RoomDirectory): RoomDirectory {
  const lost = roomDirectoryLostCodes(previous, next)
  if (lost.length === 0) return next
  const rooms = { ...next.rooms }
  for (const code of lost) {
    const room = previous.rooms[code]
    if (room?.code) rooms[code] = room
  }
  return mergeRoomDirectories([{ ...next, rooms }])
}

export function schoolNotesContentScore(
  doc: SchoolNotesDocument | null | undefined
): number {
  if (!doc) return 0
  let score = 0
  for (const text of Object.values(doc.notes ?? {})) {
    if (String(text ?? "").trim()) score += 1
  }
  score += Math.max(0, (doc.revision ?? 1) - 1)
  score += doc.notesHistory?.length ?? 0
  return score
}

/** Sparse revision-1 notes must not replace a populated school-notes document. */
export function keepRicherSchoolNotes(
  current: SchoolNotesDocument,
  incoming: SchoolNotesDocument
): SchoolNotesDocument {
  if (schoolNotesContentScore(incoming) === 0 && schoolNotesContentScore(current) > 0) {
    return current
  }
  return preferSchoolNotes([current, incoming], incoming)
}

export function preferSchoolNotes(
  docs: Array<SchoolNotesDocument | null | undefined>,
  fallback: SchoolNotesDocument
): SchoolNotesDocument {
  let best: SchoolNotesDocument | null = null
  for (const doc of docs) {
    if (!doc) continue
    if (!best) {
      best = doc
      continue
    }
    if (doc.revision !== best.revision) {
      best = doc.revision > best.revision ? doc : best
    } else if (doc.updatedAt >= best.updatedAt) {
      best = doc
    }
  }
  return best ?? fallback
}

export function mergeMemberOrder(
  docs: Array<MemberOrderDocument | null | undefined>
): MemberOrderDocument {
  const present = docs.filter((doc): doc is MemberOrderDocument => Boolean(doc))
  if (present.length === 0) return { order: [], updatedAt: "" }
  present.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
  const latest = present[present.length - 1]
  const seen = new Set(latest.order)
  const order = [...latest.order]
  for (const doc of present) {
    for (const id of doc.order) {
      if (!id || seen.has(id)) continue
      seen.add(id)
      order.push(id)
    }
  }
  return { order, updatedAt: latest.updatedAt }
}

export function mergeProfileRequests(
  docs: Array<ProfileRequestDirectory | null | undefined>
): ProfileRequestDirectory {
  const deleted = new Set<string>()
  let updatedAt = ""
  for (const doc of docs) {
    if (!doc) continue
    if (doc.updatedAt > updatedAt) updatedAt = doc.updatedAt
    for (const id of doc.deletedIds ?? []) {
      if (id) deleted.add(id)
    }
  }
  const byId = new Map<string, ProfileChangeRequest>()
  for (const doc of docs) {
    for (const request of doc?.requests ?? []) {
      if (!request?.id || deleted.has(request.id)) continue
      byId.set(request.id, request)
    }
  }
  return {
    requests: [...byId.values()].sort((a, b) => a.requestedAt.localeCompare(b.requestedAt)),
    deletedIds: [...deleted].sort(),
    updatedAt,
  }
}

export function mergeRemovedAccounts(
  indexes: Array<Record<string, RemovedAccountRecord> | null | undefined>
): Record<string, RemovedAccountRecord> {
  const out: Record<string, RemovedAccountRecord> = {}
  for (const index of indexes) {
    if (!index) continue
    for (const [loginId, record] of Object.entries(index)) {
      const current = out[loginId]
      if (!current || record.removedAt >= current.removedAt) {
        out[loginId] = record
      }
    }
  }
  return out
}

export function pruneMembersByTombstone<T extends { id: string }>(
  members: T[],
  deletedIds: Iterable<string>
): T[] {
  const deleted = deletedIds instanceof Set ? deletedIds : new Set(deletedIds)
  if (deleted.size === 0) return members
  return members.filter((member) => !deleted.has(member.id))
}

export type LayerStatus = "hit" | "miss" | "error" | "skip"

/**
 * Blob skip means the store was not read — not that the key is absent.
 * Treating skip as empty was wiping /tmp + cache after each Vercel deploy.
 */
export function layersAreConfirmedEmpty(input: {
  unreliable: boolean
  blobStatus: LayerStatus
  cacheStatus: LayerStatus
  file: unknown
  snapshot: unknown
}): boolean {
  if (input.unreliable) return false
  if (input.blobStatus === "hit" || input.cacheStatus === "hit") return false
  if (input.file != null || input.snapshot != null) return false
  return (
    input.blobStatus === "miss" &&
    (input.cacheStatus === "miss" || input.cacheStatus === "skip")
  )
}
