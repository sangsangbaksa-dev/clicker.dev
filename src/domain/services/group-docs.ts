import type { ClassGroup, GroupDocument, Room } from "@/domain/entities/board"

export const MAX_GROUP_DOCUMENTS = 8
export const MAX_DOCUMENT_TITLE = 120
export const MAX_DOCUMENT_BODY = 80_000
export const UNTITLED_DOCUMENT = "제목 없는 문서"

export function defaultDocumentId(groupId: string): string {
  return `${groupId}:main`
}

export function emptyDocument(
  groupId: string,
  createdAt: string,
  id = defaultDocumentId(groupId)
): GroupDocument {
  return {
    id,
    title: UNTITLED_DOCUMENT,
    body: "",
    revision: 1,
    updatedAt: createdAt,
    updatedById: "",
    updatedBy: "",
  }
}

function uniqueId(raw: unknown): string {
  return String(raw ?? "").trim()
}

export function sanitizeDocuments(
  raw: unknown,
  groupId: string,
  createdAt: string
): GroupDocument[] {
  const fallback = [emptyDocument(groupId, createdAt)]
  if (!Array.isArray(raw)) return fallback
  const documents: GroupDocument[] = []
  const seen = new Set<string>()
  for (const item of raw.slice(0, MAX_GROUP_DOCUMENTS)) {
    if (!item || typeof item !== "object") continue
    const row = item as Partial<GroupDocument>
    const id = uniqueId(row.id)
    if (!id || seen.has(id)) continue
    seen.add(id)
    const revision = Number(row.revision)
    documents.push({
      id,
      title: String(row.title ?? UNTITLED_DOCUMENT).slice(0, MAX_DOCUMENT_TITLE) || UNTITLED_DOCUMENT,
      body: String(row.body ?? "").slice(0, MAX_DOCUMENT_BODY),
      revision: Number.isInteger(revision) && revision >= 1 ? revision : 1,
      updatedAt: String(row.updatedAt ?? createdAt),
      updatedById: String(row.updatedById ?? "").slice(0, 64),
      updatedBy: String(row.updatedBy ?? "").slice(0, 20),
    })
  }
  return documents.length > 0 ? documents : fallback
}

export function ensureDefaultDocuments(group: ClassGroup): ClassGroup {
  return {
    ...group,
    documents: sanitizeDocuments(group.documents, group.id, group.createdAt),
  }
}

export function groupsWithoutDocuments(groups: ClassGroup[]): ClassGroup[] {
  return groups.map((group) => ({
    ...group,
    documents: [],
    messages: [],
    typing: [],
  }))
}

export function roomWithoutGroupDocuments(room: Room): Room {
  return {
    ...room,
    groups: groupsWithoutDocuments(room.groups ?? []),
  }
}

/** Board PUT never carries document bodies; keep what is already stored. */
export function preserveGroupDocuments(
  previous: ClassGroup[],
  incoming: ClassGroup[]
): ClassGroup[] {
  const previousById = new Map(previous.map((group) => [group.id, group]))
  return incoming.map((group) => {
    const stored = previousById.get(group.id)
    return {
      ...group,
      documents: stored
        ? sanitizeDocuments(stored.documents, group.id, group.createdAt)
        : sanitizeDocuments(group.documents, group.id, group.createdAt),
    }
  })
}

export function canReadGroupDocuments(
  group: Pick<ClassGroup, "memberIds">,
  userId: string,
  _isAdmin = false
): boolean {
  const id = userId.trim()
  if (!id) return false
  return group.memberIds.includes(id)
}

export function canWriteGroupDocuments(
  group: Pick<ClassGroup, "memberIds">,
  userId: string,
  isAdmin: boolean
): boolean {
  return canReadGroupDocuments(group, userId, isAdmin)
}

export function findDocument(
  group: ClassGroup,
  documentId: string
): GroupDocument | undefined {
  return group.documents.find((item) => item.id === documentId)
}

export function applyDocumentSave(
  group: ClassGroup,
  documentId: string,
  patch: { title: string; body: string },
  actor: { id: string; name: string },
  at: string
): ClassGroup | null {
  const current = findDocument(group, documentId)
  if (!current) return null
  const title = patch.title.trim().slice(0, MAX_DOCUMENT_TITLE) || UNTITLED_DOCUMENT
  const body = patch.body.slice(0, MAX_DOCUMENT_BODY)
  const next: GroupDocument = {
    ...current,
    title,
    body,
    revision: current.revision + 1,
    updatedAt: at,
    updatedById: actor.id,
    updatedBy: actor.name.slice(0, 20),
  }
  return {
    ...group,
    documents: group.documents.map((item) => (item.id === documentId ? next : item)),
  }
}

export function addGroupDocument(
  group: ClassGroup,
  id: string,
  at: string
): ClassGroup | null {
  const documents = sanitizeDocuments(group.documents, group.id, group.createdAt)
  if (documents.length >= MAX_GROUP_DOCUMENTS) return null
  if (documents.some((item) => item.id === id)) return null
  return {
    ...group,
    documents: [...documents, emptyDocument(group.id, at, id)],
  }
}

export function removeGroupDocument(group: ClassGroup, documentId: string): ClassGroup | null {
  const documents = sanitizeDocuments(group.documents, group.id, group.createdAt)
  if (documents.length <= 1) return null
  if (!documents.some((item) => item.id === documentId)) return null
  return {
    ...group,
    documents: documents.filter((item) => item.id !== documentId),
  }
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

/** 3-way merge for one 조의 papers. Keep this computer's unsaved title/body. */
export function mergeDocumentsOnConflict(
  local: GroupDocument[],
  remote: GroupDocument[],
  base: GroupDocument[]
): GroupDocument[] {
  const remoteById = new Map(remote.map((item) => [item.id, item]))
  const baseById = new Map(base.map((item) => [item.id, item]))
  const localIds = new Set(local.map((item) => item.id))
  const merged: GroupDocument[] = []

  for (const item of local) {
    const other = remoteById.get(item.id)
    const previous = baseById.get(item.id)
    if (!other) {
      merged.push(item)
      continue
    }
    if (previous && sameJson(item, previous)) {
      merged.push(other)
      continue
    }
    merged.push({
      ...other,
      title:
        previous && item.title === previous.title ? other.title : item.title,
      body: previous && item.body === previous.body ? other.body : item.body,
      revision: other.revision,
    })
  }

  for (const item of remote) {
    if (localIds.has(item.id)) continue
    if (baseById.has(item.id)) continue
    merged.push(item)
  }

  return merged.slice(0, MAX_GROUP_DOCUMENTS)
}

export function replaceGroupDocuments(
  groups: ClassGroup[],
  groupId: string,
  documents: GroupDocument[]
): ClassGroup[] {
  return groups.map((group) =>
    group.id === groupId
      ? { ...group, documents: sanitizeDocuments(documents, group.id, group.createdAt) }
      : group
  )
}

export function documentCharCount(body: string): number {
  return Array.from(body.replace(/\s+/g, "")).length
}

export function documentsStamp(documents: GroupDocument[]): string {
  return documents.map((item) => `${item.id}:${item.revision}`).join(",")
}

/** Reattach stored papers after membership sanitizer stripped them. */
export function hydrateGroupDocuments(groups: ClassGroup[], raw: unknown): ClassGroup[] {
  const byId = new Map<string, unknown>()
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue
      const id = String((item as { id?: string }).id ?? "").trim()
      if (id) byId.set(id, item)
    }
  }
  return groups.map((group) => {
    const row = byId.get(group.id) as { documents?: unknown } | undefined
    return {
      ...group,
      documents: sanitizeDocuments(row?.documents, group.id, group.createdAt),
    }
  })
}
