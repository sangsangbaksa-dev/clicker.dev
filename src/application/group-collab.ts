import { fail, ok, type UseCaseResult } from "@/application/result"
import { toChatView } from "@/application/group-chat"
import type { GroupChatView } from "@/application/group-chat"
import type { GroupDocsView } from "@/application/group-docs"
import { canEditRoomContent, isSiteAdmin } from "@/domain/services/access-level"
import { groupLabel } from "@/domain/services/class-groups"
import {
  canReadGroupDocuments,
  canWriteGroupDocuments,
  documentsStamp,
  sanitizeDocuments,
} from "@/domain/services/group-docs"
import {
  canReadGroupChat,
  messagesStamp,
  sanitizeTyping,
  setTyping,
} from "@/domain/services/group-chat"
import type { ClassGroup, GroupTypingSurface, Room } from "@/domain/entities/board"
import type { PublicUser } from "@/domain/entities/user"
import { getRoomFresh, saveRoom } from "@/infrastructure/persistence/room-repository"
import { SharedStoreUnavailableError } from "@/infrastructure/persistence/shared-store-error"

const NOT_FOUND_ROOM = "화산중을 찾을 수 없습니다."
const NOT_FOUND_GROUP = "조를 찾을 수 없습니다."
const FORBIDDEN = "이 조 조원만 문서와 대화를 볼 수 있습니다."
const STORE_UNAVAILABLE = "반 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."

export type GroupLiveView = {
  groupId: string
  label: string
  canEdit: boolean
  docsStamp: string
  chatStamp: string
  documents: GroupDocsView["documents"]
  chat: GroupChatView
  typing: ReturnType<typeof sanitizeTyping>
  unchanged?: boolean
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

export async function getGroupLive(input: {
  code: string
  groupId: string
  actor: PublicUser
  docsStamp?: string
  chatStamp?: string
}): Promise<UseCaseResult<GroupLiveView>> {
  try {
    const room = await getRoomFresh(input.code)
    if (!room) return fail(404, NOT_FOUND_ROOM)
    const group = findGroup(room, input.groupId)
    if (!group) return fail(404, NOT_FOUND_GROUP)
    const admin = isSiteAdmin(input.actor)
    if (!canReadGroupDocuments(group, input.actor.id, admin)) {
      return fail(403, FORBIDDEN)
    }

    const documents = sanitizeDocuments(group.documents, group.id, group.createdAt)
    const nextDocsStamp = documentsStamp(documents)
    const chat = toChatView(input.code, group, input.actor, room)
    const nextChatStamp = messagesStamp(group.messages ?? [])
    const typing = sanitizeTyping(group.typing)
    const unchanged =
      Boolean(input.docsStamp) &&
      Boolean(input.chatStamp) &&
      input.docsStamp === nextDocsStamp &&
      input.chatStamp === nextChatStamp

    return ok({
      groupId: group.id,
      label: groupLabel(group),
      canEdit:
        canEditRoomContent(input.actor, room) &&
        canWriteGroupDocuments(group, input.actor.id, admin),
      docsStamp: nextDocsStamp,
      chatStamp: nextChatStamp,
      documents: unchanged ? [] : documents,
      chat: unchanged ? { ...chat, messages: [] } : chat,
      typing,
      unchanged,
    })
  } catch (error) {
    return storeFail(error) ?? fail(400, error instanceof Error ? error.message : NOT_FOUND_ROOM)
  }
}

export async function touchGroupTyping(input: {
  code: string
  groupId: string
  actor: PublicUser
  surface: GroupTypingSurface
}): Promise<UseCaseResult<{ typing: ReturnType<typeof sanitizeTyping> }>> {
  try {
    const room = await getRoomFresh(input.code)
    if (!room) return fail(404, NOT_FOUND_ROOM)
    const group = findGroup(room, input.groupId)
    if (!group) return fail(404, NOT_FOUND_GROUP)
    if (!canReadGroupChat(group, input.actor.id, isSiteAdmin(input.actor))) {
      return fail(403, FORBIDDEN)
    }
    const typing = setTyping(group.typing, input.actor, input.surface)
    const groups = (room.groups ?? []).map((item) =>
      item.id === group.id ? { ...item, typing } : item
    )
    await saveRoom({ ...room, groups })
    return ok({ typing })
  } catch (error) {
    return storeFail(error) ?? fail(400, "상태를 보내지 못했습니다.")
  }
}
