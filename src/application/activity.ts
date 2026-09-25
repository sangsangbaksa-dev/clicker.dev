import { CLASSES } from "@/shared/classes"
import type { UserActivityItem } from "@/domain/entities/user"
import { loadRoomDirectory } from "@/infrastructure/persistence/room-directory"
import { getSchoolNotes } from "@/infrastructure/persistence/school-notes-repository"
import { schoolNoteLabel } from "@/domain/services/school-note-kinds"
import { SUBJECT_NOTE_LABELS } from "@/domain/services/subject-notes"
import type { NoteKind, Room } from "@/domain/entities/board"

function classNoteKindLabel(kind: NoteKind | undefined): string | undefined {
  if (!kind || !(kind in SUBJECT_NOTE_LABELS)) return undefined
  return SUBJECT_NOTE_LABELS[kind as keyof typeof SUBJECT_NOTE_LABELS]
}

function pushActivity(
  buckets: Map<string, UserActivityItem[]>,
  userId: string,
  item: UserActivityItem
) {
  const list = buckets.get(userId)
  if (list) list.push(item)
}

function collectFromRoom(
  buckets: Map<string, UserActivityItem[]>,
  userIdSet: Set<string>,
  room: Room,
  roomLabel: string
) {
  for (const update of room.updates) {
    if (!update.authorId || !userIdSet.has(update.authorId)) continue
    pushActivity(buckets, update.authorId, {
      kind: "update",
      roomCode: room.code,
      roomLabel,
      text: update.text,
      createdAt: update.createdAt,
    })
  }

  for (const task of room.tasks) {
    for (const comment of task.comments ?? []) {
      if (!comment.authorId || !userIdSet.has(comment.authorId)) continue
      pushActivity(buckets, comment.authorId, {
        kind: "comment",
        roomCode: room.code,
        roomLabel,
        text: comment.text,
        createdAt: comment.createdAt,
        taskTitle: task.title,
      })
    }
  }

  for (const edit of room.notesHistory ?? []) {
    if (!edit.authorId || !userIdSet.has(edit.authorId)) continue
    if (edit.taskTitle) {
      pushActivity(buckets, edit.authorId, {
        kind: "task",
        roomCode: room.code,
        roomLabel,
        added: edit.added,
        removed: edit.removed,
        taskTitle: edit.taskTitle,
        createdAt: edit.createdAt,
      })
      continue
    }
    pushActivity(buckets, edit.authorId, {
      kind: "note",
      roomCode: room.code,
      roomLabel,
      added: edit.added,
      removed: edit.removed,
      noteKind: classNoteKindLabel(edit.noteKind),
      createdAt: edit.createdAt,
    })
  }
}

function finalizeBuckets(
  buckets: Map<string, UserActivityItem[]>,
  limit: number
): Record<string, UserActivityItem[]> {
  const result: Record<string, UserActivityItem[]> = {}
  for (const [userId, items] of buckets) {
    const sorted = items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    result[userId] = limit <= 0 ? sorted : sorted.slice(0, limit)
  }
  return result
}

/** Load rooms and school notes once, then slice activity per user. */
export async function collectUserActivityMap(
  userIds: string[],
  limit = 8
): Promise<Record<string, UserActivityItem[]>> {
  const unique = [...new Set(userIds)]
  const buckets = new Map<string, UserActivityItem[]>()
  for (const userId of unique) {
    buckets.set(userId, [])
  }
  if (unique.length === 0) return {}

  const userIdSet = new Set(unique)

  const { dir } = await loadRoomDirectory()
  for (const cls of CLASSES) {
    const room = dir.rooms[cls.code]
    if (!room) continue
    collectFromRoom(buckets, userIdSet, room, cls.label)
  }

  const school = await getSchoolNotes()
  for (const edit of school.notesHistory ?? []) {
    if (!edit.authorId || !userIdSet.has(edit.authorId)) continue
    pushActivity(buckets, edit.authorId, {
      kind: "note",
      roomCode: "SCHOOL",
      roomLabel: "전교",
      added: edit.added,
      removed: edit.removed,
      noteKind: schoolNoteLabel(edit.noteKind),
      createdAt: edit.createdAt,
    })
  }

  return finalizeBuckets(buckets, limit)
}

export async function collectUserActivity(
  userId: string,
  limit = 8
): Promise<UserActivityItem[]> {
  const map = await collectUserActivityMap([userId], limit)
  return map[userId] ?? []
}
