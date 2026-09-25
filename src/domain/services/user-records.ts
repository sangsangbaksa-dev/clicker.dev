import type { NoteEdit, Room, SchoolNotesDocument, Task } from "@/domain/entities/board"

export type ClearedUserRecords = {
  updates: number
  comments: number
  tasks: number
  history: number
}

export function emptyClearedUserRecords(): ClearedUserRecords {
  return { updates: 0, comments: 0, tasks: 0, history: 0 }
}

export function addClearedUserRecords(
  a: ClearedUserRecords,
  b: ClearedUserRecords
): ClearedUserRecords {
  return {
    updates: a.updates + b.updates,
    comments: a.comments + b.comments,
    tasks: a.tasks + b.tasks,
    history: a.history + b.history,
  }
}

export function clearedUserRecordsCount(cleared: ClearedUserRecords): number {
  return cleared.updates + cleared.comments + cleared.tasks + cleared.history
}

function taskTitlesCreatedBy(history: NoteEdit[], userId: string): Set<string> {
  const byTitle = new Map<string, NoteEdit[]>()
  for (const edit of history) {
    const title = edit.taskTitle?.trim()
    if (!title) continue
    const list = byTitle.get(title) ?? []
    list.push(edit)
    byTitle.set(title, list)
  }
  const titles = new Set<string>()
  for (const [title, edits] of byTitle) {
    const first = [...edits].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]
    if (first?.authorId === userId && !first.removed?.trim()) {
      titles.add(title)
    }
  }
  return titles
}

function keepTasksNotCreatedBy(tasks: Task[], createdTitles: Set<string>): Task[] {
  if (createdTitles.size === 0) return tasks
  const remaining = [...createdTitles]
  return tasks.filter((task) => {
    const title = task.title.trim() || "할 일"
    const index = remaining.indexOf(title)
    if (index === -1) return true
    remaining.splice(index, 1)
    return false
  })
}

/** Strip one author's 소식, 댓글, 본인이 만든 할 일, and 수정기록 from a class board. */
export function clearUserRecordsFromRoom(room: Room, userId: string): {
  room: Room
  cleared: ClearedUserRecords
} {
  const history = room.notesHistory ?? []
  const createdTitles = taskTitlesCreatedBy(history, userId)
  const nextTasks = keepTasksNotCreatedBy(room.tasks ?? [], createdTitles)
  const nextUpdates = (room.updates ?? []).filter((update) => update.authorId !== userId)
  const nextHistory = history.filter((edit) => edit.authorId !== userId)

  let comments = 0
  const tasksWithComments = nextTasks.map((task) => {
    const kept = (task.comments ?? []).filter((comment) => comment.authorId !== userId)
    comments += (task.comments ?? []).length - kept.length
    if (kept.length === (task.comments ?? []).length) return task
    return { ...task, comments: kept }
  })

  const cleared: ClearedUserRecords = {
    updates: (room.updates ?? []).length - nextUpdates.length,
    comments,
    tasks: (room.tasks ?? []).length - tasksWithComments.length,
    history: history.length - nextHistory.length,
  }

  if (clearedUserRecordsCount(cleared) === 0) {
    return { room, cleared }
  }

  return {
    room: {
      ...room,
      updates: nextUpdates,
      tasks: tasksWithComments,
      notesHistory: nextHistory,
    },
    cleared,
  }
}

export function clearUserRecordsFromSchoolNotes(
  doc: SchoolNotesDocument,
  userId: string
): { doc: SchoolNotesDocument; cleared: ClearedUserRecords } {
  const history = doc.notesHistory ?? []
  const nextHistory = history.filter((edit) => edit.authorId !== userId)
  const removed = history.length - nextHistory.length
  if (removed === 0) {
    return { doc, cleared: emptyClearedUserRecords() }
  }
  return {
    doc: { ...doc, notesHistory: nextHistory },
    cleared: { ...emptyClearedUserRecords(), history: removed },
  }
}
