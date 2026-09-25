import type { SchoolNotesDocument } from "@/domain/entities/board"
import type { PublicUser } from "@/domain/entities/user"
import { canEditSchoolNoteKind } from "@/domain/services/access-level"
import { diffNotes } from "@/domain/services/note-diff"
import {
  emptySchoolNotes,
  normalizeSchoolNotes,
  sanitizeSchoolNotes,
  SCHOOL_NOTE_KINDS,
} from "@/domain/services/school-note-kinds"
import { createId } from "@/shared/ids"
import { preferSchoolNotes, keepRicherSchoolNotes } from "@/infrastructure/persistence/shared-merge"
import { SharedStoreUnavailableError } from "@/infrastructure/persistence/shared-store-error"
import {
  readJsonFile,
  readSharedLayers,
  rememberSnapshot,
  sharedFilePath,
  writeJsonFile,
  writeSharedJson,
} from "@/infrastructure/persistence/shared-json-store"

const FILE_PATH = sharedFilePath("school-notes.json")
const STORE_KEY = "school-notes"
const NETLIFY_STORE = "sohaengbang-rooms"

function nowIso(): string {
  return new Date().toISOString()
}

function shouldUseNetlifyBlobs(): boolean {
  return (
    process.env.NETLIFY === "true" ||
    Boolean(process.env.NETLIFY_BLOBS_CONTEXT) ||
    Boolean(process.env.BLOBS_CONTEXT)
  )
}

async function netlifyStore() {
  const { getStore } = await import("@netlify/blobs")
  return getStore(NETLIFY_STORE)
}

function defaultDocument(): SchoolNotesDocument {
  const createdAt = nowIso()
  return {
    notes: emptySchoolNotes(),
    revision: 1,
    createdAt,
    updatedAt: createdAt,
    notesHistory: [],
  }
}

function normalizeDocument(raw: Partial<SchoolNotesDocument> | null): SchoolNotesDocument | null {
  if (!raw || typeof raw !== "object") return null
  const legacy = (raw as { subjectNotes?: Partial<import("@/domain/entities/board").SchoolNotes> })
    .subjectNotes
  const notes = normalizeSchoolNotes(raw.notes ?? legacy)
  return {
    notes,
    revision: typeof raw.revision === "number" && raw.revision > 0 ? raw.revision : 1,
    createdAt: String(raw.createdAt ?? nowIso()),
    updatedAt: String(raw.updatedAt ?? nowIso()),
    notesHistory: Array.isArray(raw.notesHistory) ? raw.notesHistory : [],
  }
}

async function readFromNetlify(): Promise<SchoolNotesDocument | null> {
  if (!shouldUseNetlifyBlobs()) return null
  try {
    const store = await netlifyStore()
    const value = await store.get(STORE_KEY, { type: "json" })
    return value ? normalizeDocument(value as SchoolNotesDocument) : null
  } catch {
    return null
  }
}

function isSparseDocument(doc: SchoolNotesDocument): boolean {
  return (
    doc.revision <= 1 &&
    SCHOOL_NOTE_KINDS.every((kind) => !String(doc.notes[kind] ?? "").trim())
  )
}

export async function readSchoolNotes(): Promise<{
  doc: SchoolNotesDocument
  unreliable: boolean
  confirmedEmpty: boolean
}> {
  const layers = await readSharedLayers<SchoolNotesDocument>(STORE_KEY, async () =>
    normalizeDocument(await readJsonFile<SchoolNotesDocument>(FILE_PATH))
  )
  const netlify = await readFromNetlify()
  const doc = preferSchoolNotes(
    [layers.file, layers.blob, layers.cache, layers.snapshot, netlify],
    defaultDocument()
  )
  rememberSnapshot(STORE_KEY, doc)
  const confirmedEmpty = layers.confirmedEmpty && isSparseDocument(doc)
  return { doc, unreliable: layers.unreliable, confirmedEmpty }
}

export async function getSchoolNotes(): Promise<SchoolNotesDocument> {
  const { doc } = await readSchoolNotes()
  return doc
}

export async function getSchoolNotesFresh(): Promise<SchoolNotesDocument> {
  return getSchoolNotes()
}

export function touchSchoolNotes(
  doc: SchoolNotesDocument,
  patch: Partial<SchoolNotesDocument> = {}
): SchoolNotesDocument {
  return {
    ...doc,
    ...patch,
    updatedAt: nowIso(),
    revision: doc.revision + 1,
  }
}

export function sanitizeSchoolNotesInput(
  incoming: Partial<SchoolNotesDocument>,
  previous: SchoolNotesDocument
): SchoolNotesDocument {
  return {
    ...previous,
    notes: sanitizeSchoolNotes(incoming.notes ?? previous.notes),
    notesHistory: previous.notesHistory ?? [],
  }
}

/** Apply only note kinds the actor may edit; other bands stay unchanged. */
export function mergeSchoolNotesByEditPermission(
  incoming: SchoolNotesDocument,
  previous: SchoolNotesDocument,
  actor: PublicUser
): SchoolNotesDocument {
  const notes = { ...previous.notes }
  for (const kind of SCHOOL_NOTE_KINDS) {
    if (canEditSchoolNoteKind(actor, kind as import("@/domain/entities/board").SchoolNoteKind)) {
      notes[kind as import("@/domain/entities/board").SchoolNoteKind] =
        incoming.notes[kind as import("@/domain/entities/board").SchoolNoteKind]
    }
  }
  return { ...incoming, notes }
}

export function recordSchoolNotesHistory(
  incoming: SchoolNotesDocument,
  previous: SchoolNotesDocument,
  user: { id: string; name: string }
): SchoolNotesDocument {
  const previousHistory = previous.notesHistory ?? []
  const prevNotes = previous.notes
  const nextNotes = incoming.notes

  const newEntries: import("@/domain/entities/board").NoteEdit[] = []
  for (const kind of SCHOOL_NOTE_KINDS) {
    if (prevNotes[kind] === nextNotes[kind]) continue
    const { added, removed } = diffNotes(prevNotes[kind], nextNotes[kind])
    if (!added && !removed) continue
    newEntries.push({
      id: createId("note"),
      authorId: user.id,
      author: user.name,
      added,
      removed,
      noteKind: kind as import("@/domain/entities/board").SchoolNoteKind,
      createdAt: nowIso(),
    })
  }

  if (newEntries.length === 0) {
    return { ...incoming, notesHistory: previousHistory }
  }

  return {
    ...incoming,
    notesHistory: [...previousHistory, ...newEntries].slice(-200),
  }
}

export async function saveSchoolNotes(doc: SchoolNotesDocument): Promise<void> {
  const { doc: current, unreliable, confirmedEmpty } = await readSchoolNotes()
  if (unreliable && !confirmedEmpty) {
    throw new SharedStoreUnavailableError(
      "전교 노트를 불러오지 못해 저장하지 않았습니다."
    )
  }
  const merged = keepRicherSchoolNotes(current, preferSchoolNotes([current, doc], doc))
  rememberSnapshot(STORE_KEY, merged)
  await writeSharedJson(STORE_KEY, merged, () => writeJsonFile(FILE_PATH, merged))
  if (shouldUseNetlifyBlobs()) {
    try {
      const store = await netlifyStore()
      await store.setJSON(STORE_KEY, merged)
    } catch {
      // optional
    }
  }
}
