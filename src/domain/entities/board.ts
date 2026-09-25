export type Member = {
  id: string
  name: string
  role: string
  color: string
  joinedAt: string
  lastSeenAt: string
}

export type TaskComment = {
  id: string
  authorId: string
  author: string
  text: string
  createdAt: string
}

export type Task = {
  id: string
  title: string
  notes: string
  /** YYYY-MM-DD, empty if unset */
  dueDate: string
  assigneeIds: string[]
  createdAt: string
  comments: TaskComment[]
}

export type Update = {
  id: string
  author: string
  authorId?: string
  text: string
  createdAt: string
}

/** One shared paper in a 조. Only that 조의 `memberIds` (and site admins) may read or write it. */
export type GroupDocument = {
  id: string
  title: string
  body: string
  revision: number
  updatedAt: string
  updatedById: string
  updatedBy: string
}

export type GroupChatImageMime = "image/jpeg" | "image/png" | "image/webp" | "image/gif"

export type GroupMessageImage = {
  mime: GroupChatImageMime
}

/** One line in a 조 Chat. Only that 조의 `memberIds` may read or write these. */
export type GroupMessage = {
  id: string
  authorId: string
  author: string
  body: string
  createdAt: string
  image?: GroupMessageImage
}

export type GroupTypingSurface = "docs" | "chat"

export type GroupTyping = {
  userId: string
  name: string
  at: string
  surface: GroupTypingSurface
}

/** A numbered 조 inside a class board. `name` is an optional extra label. */
export type ClassGroup = {
  id: string
  n: number
  name: string
  memberIds: string[]
  createdAt: string
  /** Stored on the room; stripped from board GET/PUT payloads. */
  documents: GroupDocument[]
  /** Stored on the room; stripped from board GET/PUT payloads. */
  messages: GroupMessage[]
  typing: GroupTyping[]
}

export type SubjectNoteKind =
  | "general"
  | "korean"
  | "science"
  | "social"
  | "technology"
  | "ethics"
  | "pe"
  | "music"
  | "art"

export type SubjectNotes = Record<SubjectNoteKind, string>

export type SchoolNoteKind =
  | "english_s"
  | "english_a"
  | "english_b"
  | "english_c"
  | "english_d"
  | "english_e"
  | "math_s"
  | "math_a"
  | "math_b"
  | "math_c"
  | "math_d"
  | "math_e"

export type SchoolNotes = Record<SchoolNoteKind, string>

export type NoteKind = SubjectNoteKind | SchoolNoteKind

export type NoteEdit = {
  id: string
  authorId: string
  author: string
  added: string
  removed: string
  createdAt: string
  /** Which note tab was edited. */
  noteKind?: NoteKind
  /** Set when this row is a 할 일 write, not a note. */
  taskTitle?: string
}

export type { AccessLevel, UserStatus } from "@/domain/entities/user"
import type { AccessLevel, UserStatus } from "@/domain/entities/user"

export type AuthUser = {
  id: string
  loginId: string
  name: string
  status: UserStatus
  accessLevel: AccessLevel
  classN?: import("@/domain/entities/user").ClassNumber
  englishLevel?: import("@/domain/entities/user").SchoolLevel
  mathLevel?: import("@/domain/entities/user").SchoolLevel
  contentHold?: import("@/domain/entities/user").ContentHold
}

export type SchoolNotesDocument = {
  notes: SchoolNotes
  revision: number
  createdAt: string
  updatedAt: string
  notesHistory?: NoteEdit[]
}

export type Room = {
  code: string
  title: string
  subject: string
  description: string
  deadline: string
  createdBy: string
  createdAt: string
  updatedAt: string
  revision: number
  /** @deprecated synced from subjectNotes.general */
  notes: string
  /** Per-class subject notes (each 반 has its own set). */
  subjectNotes?: SubjectNotes
  /** Server-recorded audit trail for shared notes edits (admin visibility). */
  notesHistory?: NoteEdit[]
  members: Member[]
  tasks: Task[]
  updates: Update[]
  groups?: ClassGroup[]
}

/** @deprecated use AuthUser from login session */
export type Profile = {
  id: string
  name: string
}

export type CreateRoomInput = {
  title: string
  subject: string
  description: string
  deadline: string
  creatorName: string
  creatorId?: string
}
