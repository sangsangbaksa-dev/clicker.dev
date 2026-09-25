import { rejectDisallowedContent } from "@/application/moderation"
import { fail, ok, type UseCaseResult } from "@/application/result"
import { canEditRoomContent, isSiteAdmin } from "@/domain/services/access-level"
import { groupLabel } from "@/domain/services/class-groups"
import { addedTexts } from "@/domain/services/content-moderation"
import type { ClassGroup, GroupDocument, Room } from "@/domain/entities/board"
import {
  addGroupDocument,
  applyDocumentSave,
  canReadGroupDocuments,
  canWriteGroupDocuments,
  findDocument,
  MAX_GROUP_DOCUMENTS,
  removeGroupDocument,
  replaceGroupDocuments,
  sanitizeDocuments,
} from "@/domain/services/group-docs"
import { touchRoom } from "@/domain/services/room-mutations"
import type { PublicUser } from "@/domain/entities/user"
import { getRoomFresh, saveRoom } from "@/infrastructure/persistence/room-repository"
import { SharedStoreUnavailableError } from "@/infrastructure/persistence/shared-store-error"
import { createId } from "@/shared/ids"

const NOT_FOUND_ROOM = "화산중을 찾을 수 없습니다."
const NOT_FOUND_GROUP = "조를 찾을 수 없습니다."
const NOT_FOUND_DOC = "문서를 찾을 수 없습니다."
const FORBIDDEN = "이 조 조원만 문서를 볼 수 있습니다."
const FORBIDDEN_WRITE = "이 조 조원만 문서를 수정할 수 있습니다."
const CONFLICT = "다른 친구가 먼저 저장했습니다."
const STORE_UNAVAILABLE = "반 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
const LAST_DOC = "조 문서는 하나 이상 있어야 합니다."
const FULL = `문서는 ${MAX_GROUP_DOCUMENTS}개까지입니다.`

export type GroupDocsView = {
  groupId: string
  label: string
  canEdit: boolean
  documents: GroupDocument[]
}

function storeFail<T>(error: unknown): UseCaseResult<T> | null {
  if (error instanceof SharedStoreUnavailableError) {
    return fail(503, error.message || STORE_UNAVAILABLE)
  }
  return null
}

function findGroup(room: Room, groupId: string): ClassGroup | undefined {
  return (room.groups ?? []).find((group) => group.id === groupId)
}

function withSanitizedDocs(group: ClassGroup): ClassGroup {
  return {
    ...group,
    documents: sanitizeDocuments(group.documents, group.id, group.createdAt),
  }
}

function viewFor(group: ClassGroup, actor: PublicUser, room: Room): GroupDocsView {
  const current = withSanitizedDocs(group)
  const admin = isSiteAdmin(actor)
  return {
    groupId: current.id,
    label: groupLabel(current),
    canEdit: canEditRoomContent(actor, room) && canWriteGroupDocuments(current, actor.id, admin),
    documents: current.documents,
  }
}

async function loadWritableGroup(input: {
  code: string
  groupId: string
  actor: PublicUser
}): Promise<UseCaseResult<{ room: Room; group: ClassGroup }>> {
  const room = await getRoomFresh(input.code)
  if (!room) return fail(404, NOT_FOUND_ROOM)
  const group = findGroup(room, input.groupId)
  if (!group) return fail(404, NOT_FOUND_GROUP)
  const admin = isSiteAdmin(input.actor)
  if (!canEditRoomContent(input.actor, room)) return fail(403, FORBIDDEN_WRITE)
  if (!canWriteGroupDocuments(group, input.actor.id, admin)) return fail(403, FORBIDDEN_WRITE)
  return ok({ room, group: withSanitizedDocs(group) })
}

export async function listGroupDocuments(input: {
  code: string
  groupId: string
  actor: PublicUser
}): Promise<UseCaseResult<GroupDocsView>> {
  try {
    const room = await getRoomFresh(input.code)
    if (!room) return fail(404, NOT_FOUND_ROOM)
    const group = findGroup(room, input.groupId)
    if (!group) return fail(404, NOT_FOUND_GROUP)
    if (!canReadGroupDocuments(group, input.actor.id, isSiteAdmin(input.actor))) {
      return fail(403, FORBIDDEN)
    }
    return ok(viewFor(group, input.actor, room))
  } catch (error) {
    return storeFail(error) ?? fail(400, error instanceof Error ? error.message : NOT_FOUND_ROOM)
  }
}

export async function saveGroupDocument(input: {
  code: string
  groupId: string
  documentId: string
  title: string
  body: string
  clientRevision: number
  actor: PublicUser
}): Promise<UseCaseResult<GroupDocsView>> {
  try {
    const first = await loadWritableGroup(input)
    if (!first.ok) return first
    const { room, group } = first.value
    const current = findDocument(group, input.documentId)
    if (!current) return fail(404, NOT_FOUND_DOC)
    if (input.clientRevision !== current.revision) {
      return fail(409, CONFLICT, {
        conflict: true,
        payload: { ...viewFor(group, input.actor, room) },
      })
    }

    const blocked = await rejectDisallowedContent(
      input.actor,
      addedTexts([current.title, current.body], [input.title, input.body])
    )
    if (blocked) return blocked

    const nextGroup = applyDocumentSave(
      group,
      input.documentId,
      { title: input.title, body: input.body },
      input.actor,
      new Date().toISOString()
    )
    if (!nextGroup) return fail(404, NOT_FOUND_DOC)

    const groups = replaceGroupDocuments(room.groups ?? [], group.id, nextGroup.documents)
    const saved = touchRoom({ ...room, groups })
    await saveRoom(saved)
    const stored = findGroup(saved, group.id)
    if (!stored) return fail(404, NOT_FOUND_GROUP)
    return ok(viewFor(stored, input.actor, saved))
  } catch (error) {
    return (
      storeFail(error) ??
      fail(400, error instanceof Error ? error.message : "저장하지 못했습니다.")
    )
  }
}

export async function createGroupDocument(input: {
  code: string
  groupId: string
  actor: PublicUser
}): Promise<UseCaseResult<GroupDocsView>> {
  try {
    const loaded = await loadWritableGroup(input)
    if (!loaded.ok) return loaded
    const { room, group } = loaded.value
    const nextGroup = addGroupDocument(group, createId("gdoc"), new Date().toISOString())
    if (!nextGroup) return fail(400, FULL)
    const groups = replaceGroupDocuments(room.groups ?? [], group.id, nextGroup.documents)
    const saved = touchRoom({ ...room, groups })
    await saveRoom(saved)
    const stored = findGroup(saved, group.id)
    if (!stored) return fail(404, NOT_FOUND_GROUP)
    return ok(viewFor(stored, input.actor, saved))
  } catch (error) {
    return (
      storeFail(error) ??
      fail(400, error instanceof Error ? error.message : "문서를 만들지 못했습니다.")
    )
  }
}

export async function deleteGroupDocument(input: {
  code: string
  groupId: string
  documentId: string
  actor: PublicUser
}): Promise<UseCaseResult<GroupDocsView>> {
  try {
    const loaded = await loadWritableGroup(input)
    if (!loaded.ok) return loaded
    const { room, group } = loaded.value
    if (!findDocument(group, input.documentId)) return fail(404, NOT_FOUND_DOC)
    const nextGroup = removeGroupDocument(group, input.documentId)
    if (!nextGroup) return fail(400, LAST_DOC)
    const groups = replaceGroupDocuments(room.groups ?? [], group.id, nextGroup.documents)
    const saved = touchRoom({ ...room, groups })
    await saveRoom(saved)
    const stored = findGroup(saved, group.id)
    if (!stored) return fail(404, NOT_FOUND_GROUP)
    return ok(viewFor(stored, input.actor, saved))
  } catch (error) {
    return (
      storeFail(error) ??
      fail(400, error instanceof Error ? error.message : "문서를 지우지 못했습니다.")
    )
  }
}
