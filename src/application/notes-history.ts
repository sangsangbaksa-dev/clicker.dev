import type { SessionUser } from "@/domain/entities/user"
import { createId } from "@/shared/ids"
import { diffNotes } from "@/domain/services/note-diff"
import {
  normalizeSubjectNotes,
  SUBJECT_NOTE_KINDS,
} from "@/domain/services/subject-notes"
import { isSchoolNoteKind } from "@/domain/services/school-note-kinds"
import { listTaskWriteChanges } from "@/domain/services/task-history"
import type { NoteEdit, NoteKind, Room, SubjectNoteKind } from "@/domain/entities/board"

const MAX = 200

export function recordNotesHistory(incoming: Room, previous: Room, user: SessionUser): Room {
  const previousHistory = previous.notesHistory ?? []
  const prevNotes = normalizeSubjectNotes(previous.subjectNotes, previous.notes)
  const nextNotes = normalizeSubjectNotes(incoming.subjectNotes, incoming.notes)
  const newEntries: NoteEdit[] = []

  for (const kind of SUBJECT_NOTE_KINDS) {
    if (prevNotes[kind] === nextNotes[kind]) continue
    const { added, removed } = diffNotes(prevNotes[kind], nextNotes[kind])
    if (!added && !removed) continue
    newEntries.push({
      id: createId("note"),
      authorId: user.id,
      author: user.name,
      added,
      removed,
      noteKind: kind,
      createdAt: new Date().toISOString(),
    })
  }

  for (const change of listTaskWriteChanges(previous.tasks ?? [], incoming.tasks ?? [])) {
    const { added, removed } = diffNotes(change.previousText, change.nextText)
    if (!added && !removed) continue
    newEntries.push({
      id: createId("note"),
      authorId: user.id,
      author: user.name,
      added,
      removed,
      taskTitle: change.taskTitle.slice(0, 80),
      createdAt: new Date().toISOString(),
    })
  }

  if (newEntries.length === 0) return { ...incoming, notesHistory: previousHistory }
  return { ...incoming, notesHistory: [...previousHistory, ...newEntries].slice(-MAX) }
}

export function sanitizeNotesHistory(previous: Room, input?: NoteEdit[]): NoteEdit[] {
  const source = input ?? previous.notesHistory ?? []
  return source.slice(-MAX).map((entry) => ({
    id: String(entry.id ?? "").slice(0, 64),
    authorId: String(entry.authorId ?? "").slice(0, 64),
    author: String(entry.author ?? "").slice(0, 20),
    added: String(entry.added ?? "").slice(0, 5000),
    removed: String(entry.removed ?? "").slice(0, 5000),
    noteKind: sanitizeNoteKind(entry.noteKind),
    taskTitle: entry.taskTitle ? String(entry.taskTitle).slice(0, 80) : undefined,
    createdAt: entry.createdAt,
  }))
}

function sanitizeNoteKind(value: unknown): NoteKind | undefined {
  if (typeof value !== "string") return undefined
  if (SUBJECT_NOTE_KINDS.includes(value as SubjectNoteKind)) return value as SubjectNoteKind
  if (isSchoolNoteKind(value)) return value
  return undefined
}
