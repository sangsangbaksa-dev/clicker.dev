import {
  CLASSES,
  HOMEROOM_CLASSES,
  classFromCode,
  createClassRoom,
  toClassSummary,
  type ClassSummary,
} from "@/shared/classes"
import { colorForIndex, createId, createRoomCode, normalizeRoomCode } from "@/shared/ids"
import {
  normalizeSubjectNotes,
  sanitizeSubjectNotes,
  syncLegacyNotesField,
} from "@/domain/services/subject-notes"
import { touchRoom } from "@/domain/services/room-mutations"
import { dropMemberFromGroups, sanitizeGroups } from "@/domain/services/class-groups"
import { hydrateGroupDocuments } from "@/domain/services/group-docs"
import { hydrateGroupMessages } from "@/domain/services/group-chat"
import { pruneExpiredTasks } from "@/domain/services/task-rules"
import type { CreateRoomInput, Member, Room } from "@/domain/entities/board"
import {
  invalidateRoomDirectory,
  loadRoomDirectory,
  saveRoomInDirectory,
} from "@/infrastructure/persistence/room-directory"
import { SharedStoreUnavailableError } from "@/infrastructure/persistence/shared-store-error"
import { clearPersistedTaskLedger } from "@/infrastructure/persistence/task-ledger"

/** In-process read cache — collapses overlapping poll/heartbeat reads in one request. */
const ROOM_CACHE_TTL_MS = 8_000
const SUMMARIES_CACHE_TTL_MS = 8_000
type CachedRoom = { room: Room; loadedAt: number }
const roomCache = new Map<string, CachedRoom>()
let summariesCache: { loadedAt: number; data: ClassSummary[] } | null = null

function nowIso(): string {
  return new Date().toISOString()
}

function cacheRoom(room: Room) {
  roomCache.set(room.code, { room, loadedAt: Date.now() })
}

export function invalidateRoomCache(code?: string) {
  if (code) {
    roomCache.delete(normalizeRoomCode(code))
  } else {
    roomCache.clear()
    invalidateRoomDirectory()
  }
  summariesCache = null
}

function getCachedRoom(code: string): Room | null {
  const entry = roomCache.get(code)
  if (!entry) return null
  if (Date.now() - entry.loadedAt > ROOM_CACHE_TTL_MS) {
    roomCache.delete(code)
    return null
  }
  return entry.room
}

export async function getRoom(code: string): Promise<Room | null> {
  const normalized = normalizeRoomCode(code)
  if (!normalized) return null

  const cached = getCachedRoom(normalized)
  if (cached) return expireRoomTasksIfNeeded(cached)

  return loadRoom(normalized)
}

async function expireRoomTasksIfNeeded(room: Room): Promise<Room> {
  const tasks = pruneExpiredTasks(room.tasks)
  if (tasks.length === room.tasks.length) {
    cacheRoom(room)
    return room
  }
  const next = { ...room, tasks }
  cacheRoom(next)
  return next
}

async function loadRoom(normalized: string, fresh = false): Promise<Room | null> {
  const { dir, unreliable, confirmedEmpty } = await loadRoomDirectory({ fresh })
  const room = dir.rooms[normalized] ?? null

  if (!room) {
    const cls = classFromCode(normalized)
    if (!cls) return null
    // Read-only fallback: empty class shell beats a hard error when Blob is flaky.
    // Writes still guard via saveRoomInDirectory / writeSharedJson.
    return createClassRoom(cls)
  }

  const next = normalizeStoredRoom(room as Room & { resources?: unknown[] })
  return expireRoomTasksIfNeeded(next)
}

/** Bypass read cache — use immediately before any disk write (heartbeat/join/PUT). */
export async function getRoomFresh(code: string): Promise<Room | null> {
  const normalized = normalizeRoomCode(code)
  if (!normalized) return null
  roomCache.delete(normalized)
  summariesCache = null
  return loadRoom(normalized, true)
}

function normalizeStoredRoom(raw: Room & { resources?: unknown[] }): Room {
  const tasks = (raw.tasks ?? []).map((task) => ({
    id: task.id,
    title: String(task.title ?? ""),
    notes: String(task.notes ?? ""),
    dueDate: String((task as { dueDate?: string }).dueDate ?? ""),
    assigneeIds: task.assigneeIds ?? [],
    createdAt: task.createdAt,
    comments: (task.comments ?? []).map((comment) => ({
      id: comment.id,
      authorId: String(comment.authorId ?? ""),
      author: String(comment.author ?? ""),
      text: String(comment.text ?? ""),
      createdAt: comment.createdAt,
    })),
  }))
  const { resources: _resources, ...rest } = raw
  const subjectNotes = normalizeSubjectNotes(rest.subjectNotes, rest.notes)
  return {
    ...rest,
    ...syncLegacyNotesField(subjectNotes),
    tasks,
    groups: hydrateGroupMessages(
      hydrateGroupDocuments(sanitizeGroups(rest.groups), rest.groups),
      rest.groups
    ),
  }
}

/** Remove a deleted account from every class board member list. */
export async function removeMemberFromAllRooms(userId: string): Promise<number> {
  let removed = 0
  for (const info of CLASSES) {
    const room = await getRoomFresh(info.code)
    if (!room) continue
    const nextMembers = room.members.filter((member) => member.id !== userId)
    const nextGroups = dropMemberFromGroups(room.groups ?? [], userId)
    const membersChanged = nextMembers.length !== room.members.length
    const groupsChanged = (room.groups ?? []).some((group) =>
      group.memberIds.includes(userId)
    )
    if (!membersChanged && !groupsChanged) continue
    removed += room.members.length - nextMembers.length
    await saveRoom(touchRoom({ ...room, members: nextMembers, groups: nextGroups }))
  }
  invalidateRoomCache()
  return removed
}

/** BAN1–BAN4 중 userId가 members에 있는 방 코드, 없으면 null. */
export async function findUserClassCode(userId: string): Promise<string | null> {
  for (const info of HOMEROOM_CLASSES) {
    const room = await getRoom(info.code)
    if (room?.members.some((member) => member.id === userId)) {
      return info.code
    }
  }
  return null
}

export function warmClassSummariesCache(data: ClassSummary[]) {
  summariesCache = { loadedAt: Date.now(), data }
}

export async function listClassSummaries(): Promise<ClassSummary[]> {
  if (
    summariesCache &&
    Date.now() - summariesCache.loadedAt < SUMMARIES_CACHE_TTL_MS
  ) {
    return summariesCache.data
  }

  const { dir, unreliable, confirmedEmpty } = await loadRoomDirectory()
  if (unreliable && Object.keys(dir.rooms).length === 0 && !confirmedEmpty) {
    if (summariesCache) return summariesCache.data
  }
  const data = CLASSES.map((info) =>
    toClassSummary(info, dir.rooms[info.code] ?? createClassRoom(info))
  )
  if (!unreliable || Object.keys(dir.rooms).length > 0) {
    warmClassSummariesCache(data)
  }
  return data
}

export async function saveRoom(room: Room): Promise<void> {
  await saveRoomInDirectory(room)
  cacheRoom(room)
  summariesCache = null
}

/** Update members on a fresh room snapshot in cache only (no disk write). */
export function cacheMemberPresence(room: Room, members: Member[]): Room {
  const next = { ...room, members }
  cacheRoom(next)
  return next
}

export async function createRoom(input: CreateRoomInput): Promise<Room> {
  const title = input.title.trim()
  if (!title) {
    throw new Error("과제 이름을 입력해 주세요.")
  }
  const creatorName = input.creatorName.trim()
  if (!creatorName) {
    throw new Error("이름을 입력해 주세요.")
  }

  let code = createRoomCode()
  for (let i = 0; i < 8; i += 1) {
    const existing = await getRoom(code)
    if (!existing) break
    code = createRoomCode()
  }

  const createdAt = nowIso()
  const creatorId = input.creatorId?.trim() || createId("mem")
  const room: Room = {
    code,
    title,
    subject: input.subject.trim(),
    description: input.description.trim(),
    deadline: input.deadline,
    createdBy: creatorId,
    createdAt,
    updatedAt: createdAt,
    revision: 1,
    ...syncLegacyNotesField(sanitizeSubjectNotes(undefined)),
    members: [
      {
        id: creatorId,
        name: creatorName,
        role: "팀장",
        color: colorForIndex(0),
        joinedAt: createdAt,
        lastSeenAt: createdAt,
      },
    ],
    tasks: [],
    updates: [],
    groups: [],
  }

  await saveRoom(room)
  return room
}

export async function clearAllRoomTasks(): Promise<number> {
  const { dir, unreliable, confirmedEmpty } = await loadRoomDirectory({ fresh: true })
  if (unreliable && Object.keys(dir.rooms).length === 0 && !confirmedEmpty) {
    throw new SharedStoreUnavailableError(
      "반 데이터를 불러오지 못해 할 일을 지우지 않았습니다."
    )
  }

  let cleared = 0
  for (const room of Object.values(dir.rooms)) {
    const count = room.tasks?.length ?? 0
    if (count === 0) continue
    cleared += count
    await saveRoom(touchRoom({ ...room, tasks: [] }))
  }
  await clearPersistedTaskLedger()
  invalidateRoomCache()
  return cleared
}
