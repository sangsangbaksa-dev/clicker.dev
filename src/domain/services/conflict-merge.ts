import type { ClassGroup, Room, SchoolNotesDocument, SubjectNotes } from "@/domain/entities/board"

/** Keep the local draft only when this client actually changed the field. */
export function mergeTextFieldOnConflict(
  remote: string,
  local: string,
  base: string
): string {
  if (local === base) return remote
  if (remote === base || local === remote) return local
  return local
}

export function mergeStringRecordOnConflict<T extends Record<string, string>>(
  remote: T,
  local: T,
  base: T
): T {
  const keys = new Set([...Object.keys(remote), ...Object.keys(local), ...Object.keys(base)])
  const next = { ...remote } as T
  for (const key of keys) {
    next[key as keyof T] = mergeTextFieldOnConflict(
      remote[key] ?? "",
      local[key] ?? "",
      base[key] ?? ""
    ) as T[keyof T]
  }
  return next
}

function notesFromRoom(room: Room): Record<string, string> {
  return { ...(room.subjectNotes ?? {}), general: room.notes }
}

function mergeItemsOnConflict<T extends { id: string }>(local: T[], remote: T[]): T[] {
  const remoteIds = new Set(remote.map((item) => item.id))
  return [...remote, ...local.filter((item) => !remoteIds.has(item.id))]
}

export function mergeSchoolNotesOnConflict(
  local: SchoolNotesDocument,
  remote: SchoolNotesDocument,
  base: SchoolNotesDocument
): SchoolNotesDocument {
  return {
    ...remote,
    notes: mergeStringRecordOnConflict(remote.notes, local.notes, base.notes),
    revision: remote.revision,
  }
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

function mergeGroupsOnConflict(
  local: ClassGroup[] | undefined,
  remote: ClassGroup[] | undefined,
  base: ClassGroup[] | undefined
): ClassGroup[] | undefined {
  const ours = local ?? []
  const theirs = remote ?? []
  const previous = base ?? []
  if (sameJson(ours, previous)) return remote
  const localIds = new Set(ours.map((group) => group.id))
  const baseIds = new Set(previous.map((group) => group.id))
  const extras = theirs.filter(
    (group) => !localIds.has(group.id) && !baseIds.has(group.id)
  )
  return [...ours, ...extras]
}

/** On 409, keep this computer's unsaved fields and the other computer's saved fields. */
export function mergeRoomOnConflict(local: Room, remote: Room, base: Room): Room {
  const subjectNotes = mergeStringRecordOnConflict(
    notesFromRoom(remote),
    notesFromRoom(local),
    notesFromRoom(base)
  ) as SubjectNotes
  return {
    ...remote,
    notes: subjectNotes.general,
    subjectNotes,
    tasks: mergeItemsOnConflict(local.tasks, remote.tasks),
    updates: mergeItemsOnConflict(local.updates, remote.updates),
    title: mergeTextFieldOnConflict(remote.title, local.title, base.title),
    subject: mergeTextFieldOnConflict(remote.subject, local.subject, base.subject),
    description: mergeTextFieldOnConflict(
      remote.description,
      local.description,
      base.description
    ),
    deadline: mergeTextFieldOnConflict(remote.deadline, local.deadline, base.deadline),
    groups: mergeGroupsOnConflict(local.groups, remote.groups, base.groups),
    revision: remote.revision,
  }
}
