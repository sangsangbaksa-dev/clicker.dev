import { pruneExpiredTasks } from "@/domain/services/task-rules"
import { exclusiveGroupMembers, sanitizeGroups } from "@/domain/services/class-groups"
import { preserveGroupDocuments } from "@/domain/services/group-docs"
import { preserveGroupMessages } from "@/domain/services/group-chat"
import type { Member, Room, TaskComment } from "@/domain/entities/board"
import { colorForIndex, createId } from "@/shared/ids"

/** Heartbeat disk writes at most once per member per interval. */
export const PRESENCE_WRITE_INTERVAL_MS = 25_000

export type PresencePatchResult = {
  joined: boolean
  persist: boolean
  members: Member[]
  updates: Room["updates"]
  full?: boolean
}

function nowIso(): string {
  return new Date().toISOString()
}

export function touchRoom(room: Room): Room {
  return {
    ...room,
    updatedAt: nowIso(),
    revision: room.revision + 1,
  }
}

export function appendRoomUpdate(
  room: Room,
  session: { id: string; name: string },
  text: string
): Room {
  const trimmed = text.trim()
  if (!trimmed) {
    throw new Error("소식 내용을 입력해 주세요.")
  }
  const createdAt = nowIso()
  return touchRoom({
    ...room,
    updates: [
      ...room.updates,
      {
        id: createId("upd"),
        author: session.name.slice(0, 20),
        authorId: session.id,
        text: trimmed.slice(0, 1000),
        createdAt,
      },
    ].slice(-80),
  })
}

export function removeRoomUpdate(room: Room, updateId: string): Room {
  const nextUpdates = room.updates.filter((update) => update.id !== updateId)
  if (nextUpdates.length === room.updates.length) {
    throw new Error("소식을 찾을 수 없습니다.")
  }
  return touchRoom({ ...room, updates: nextUpdates })
}

export function shouldPersistPresence(
  members: Member[],
  memberId: string,
  nowMs: number
): boolean {
  const member = members.find((item) => item.id === memberId)
  if (!member) return true
  const lastMs = new Date(member.lastSeenAt).getTime()
  if (Number.isNaN(lastMs)) return true
  return nowMs - lastMs >= PRESENCE_WRITE_INTERVAL_MS
}

export function applyMemberPresence(
  room: Room,
  session: { id: string; name: string },
  type: "heartbeat" | "join",
  nowMs = Date.now()
): PresencePatchResult {
  const now = new Date(nowMs).toISOString()
  const memberId = session.id
  const name = session.name.slice(0, 20)
  const members = [...room.members]
  const index = members.findIndex((member) => member.id === memberId)
  let joined = false
  const updates = room.updates

  if (index >= 0) {
    members[index] = {
      ...members[index],
      name,
      lastSeenAt: now,
    }
  } else {
    if (type === "heartbeat") {
      return { joined: false, persist: false, members: room.members, updates: room.updates }
    }
    if (room.members.length >= 40) {
      return {
        joined: false,
        persist: false,
        members: room.members,
        updates: room.updates,
        full: true,
      }
    }
    joined = true
    members.push({
      id: memberId,
      name,
      role: "팀원",
      color: colorForIndex(members.length),
      joinedAt: now,
      lastSeenAt: now,
    })
  }

  const persist = joined || shouldPersistPresence(room.members, memberId, nowMs)

  return { joined, persist, members, updates }
}

export function sanitizeRoomFields(input: Room, previous: Room): Omit<Room, "notesHistory"> {
  if (input.code !== previous.code) {
    throw new Error("방 코드는 바꿀 수 없습니다.")
  }

  const members = (input.members ?? []).slice(0, 40).map((member) => ({
    ...member,
    name: String(member.name ?? "").slice(0, 20),
    role: String(member.role ?? "").slice(0, 40),
  }))
  const tasks = pruneExpiredTasks(
    (input.tasks ?? []).slice(0, 120).map((task) => {
      const raw = task as typeof task & { status?: string; dueDate?: string; comments?: TaskComment[] }
      const comments = (raw.comments ?? []).slice(0, 50).map((comment) => ({
        id: comment.id,
        authorId: String(comment.authorId ?? "").slice(0, 64),
        author: String(comment.author ?? "").slice(0, 20),
        text: String(comment.text ?? "").slice(0, 500),
        createdAt: comment.createdAt,
      }))
      return {
        id: raw.id,
        title: String(raw.title ?? "").slice(0, 80),
        notes: String(raw.notes ?? "").slice(0, 500),
        dueDate: String(raw.dueDate ?? "").slice(0, 32),
        assigneeIds: (raw.assigneeIds ?? []).slice(0, 12),
        createdAt: raw.createdAt,
        comments,
      }
    })
  )
  const updates = (input.updates ?? []).slice(-80).map((update) => ({
    id: update.id,
    author: String(update.author ?? "").slice(0, 20),
    authorId: update.authorId ? String(update.authorId).slice(0, 64) : undefined,
    text: String(update.text ?? "").slice(0, 1000),
    createdAt: update.createdAt,
  }))
  const groups = preserveGroupMessages(
    previous.groups ?? [],
    preserveGroupDocuments(
      previous.groups ?? [],
      exclusiveGroupMembers(sanitizeGroups(input.groups ?? previous.groups))
    )
  )

  return {
    ...previous,
    title: String(input.title ?? previous.title).slice(0, 60),
    subject: String(input.subject ?? previous.subject).slice(0, 30),
    description: String(input.description ?? previous.description).slice(0, 400),
    deadline: String(input.deadline ?? previous.deadline).slice(0, 32),
    members,
    tasks,
    updates,
    groups,
  }
}
