import { rejectDisallowedContent } from "@/application/moderation"
import { fail, ok, type UseCaseResult } from "@/application/result"
import { canEditRoomContent, isSiteAdmin } from "@/domain/services/access-level"
import { chatTitle } from "@/domain/services/group-chat"
import {
  appendGroupMessage,
  canPostGroupChat,
  canReadGroupChat,
  inspectGroupChatImage,
  sanitizeGroupMessages,
} from "@/domain/services/group-chat"
import { groupLabel } from "@/domain/services/class-groups"
import type { ClassGroup, GroupMessage, Room } from "@/domain/entities/board"
import type { PublicUser } from "@/domain/entities/user"
import { touchRoom } from "@/domain/services/room-mutations"
import {
  loadGroupChatImage,
  saveGroupChatImage,
} from "@/infrastructure/persistence/group-chat-media"
import { getRoomFresh, saveRoom } from "@/infrastructure/persistence/room-repository"
import { SharedStoreUnavailableError } from "@/infrastructure/persistence/shared-store-error"
import { createId } from "@/shared/ids"

const NOT_FOUND_ROOM = "화산중을 찾을 수 없습니다."
const NOT_FOUND_GROUP = "조를 찾을 수 없습니다."
const FORBIDDEN = "이 조 조원만 대화를 볼 수 있습니다."
const STORE_UNAVAILABLE = "반 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."

export type GroupChatMessageView = {
  id: string
  authorId: string
  author: string
  body: string
  createdAt: string
  mine: boolean
  imageUrl?: string
}

export type GroupChatView = {
  groupId: string
  title: string
  label: string
  canPost: boolean
  messages: GroupChatMessageView[]
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

function imageUrl(code: string, groupId: string, messageId: string) {
  return `/api/rooms/${encodeURIComponent(code)}/groups/${encodeURIComponent(groupId)}/messages/${encodeURIComponent(messageId)}/image`
}

export function toChatView(
  code: string,
  group: ClassGroup,
  actor: PublicUser,
  room: Room
): GroupChatView {
  const admin = isSiteAdmin(actor)
  return {
    groupId: group.id,
    title: chatTitle(group),
    label: groupLabel(group),
    canPost: canEditRoomContent(actor, room) && canPostGroupChat(group, actor.id, admin),
    messages: sanitizeGroupMessages(group.messages).map((message) => ({
      id: message.id,
      authorId: message.authorId,
      author: message.author,
      body: message.body,
      createdAt: message.createdAt,
      mine: message.authorId === actor.id,
      imageUrl: message.image ? imageUrl(code, group.id, message.id) : undefined,
    })),
  }
}

export async function listGroupChat(input: {
  code: string
  groupId: string
  actor: PublicUser
}): Promise<UseCaseResult<GroupChatView>> {
  try {
    const room = await getRoomFresh(input.code)
    if (!room) return fail(404, NOT_FOUND_ROOM)
    const group = findGroup(room, input.groupId)
    if (!group) return fail(404, NOT_FOUND_GROUP)
    if (!canReadGroupChat(group, input.actor.id, isSiteAdmin(input.actor))) {
      return fail(403, FORBIDDEN)
    }
    return ok(toChatView(input.code, group, input.actor, room))
  } catch (error) {
    return storeFail(error) ?? fail(400, error instanceof Error ? error.message : NOT_FOUND_ROOM)
  }
}

export async function postGroupChat(input: {
  code: string
  groupId: string
  actor: PublicUser
  body: string
  imageBytes: Uint8Array | null
}): Promise<UseCaseResult<GroupChatView>> {
  try {
    const latest = await getRoomFresh(input.code)
    if (!latest) return fail(404, NOT_FOUND_ROOM)
    const group = findGroup(latest, input.groupId)
    if (!group) return fail(404, NOT_FOUND_GROUP)
    if (!canEditRoomContent(input.actor, latest) || !canPostGroupChat(group, input.actor.id, isSiteAdmin(input.actor))) {
      return fail(403, FORBIDDEN)
    }

    let image: GroupMessage["image"]
    if (input.imageBytes && input.imageBytes.length > 0) {
      const inspected = inspectGroupChatImage(input.imageBytes)
      if (!inspected.ok) return fail(400, inspected.error)
      image = { mime: inspected.mime }
    }
    const body = input.body.trim()
    if (!body && !image) return fail(400, "메시지 또는 사진을 넣어 주세요.")

    const blocked = await rejectDisallowedContent(input.actor, body ? [body] : [])
    if (blocked) return blocked

    const message: GroupMessage = {
      id: createId("gmsg"),
      authorId: input.actor.id,
      author: input.actor.name.slice(0, 20),
      body: body.slice(0, 2000),
      createdAt: new Date().toISOString(),
      ...(image ? { image } : {}),
    }
    if (image && input.imageBytes) {
      await saveGroupChatImage({
        code: input.code,
        groupId: group.id,
        messageId: message.id,
        bytes: input.imageBytes,
        mime: image.mime,
      })
    }
    const groups = appendGroupMessage(latest.groups ?? [], group.id, message)
    const saved = touchRoom({ ...latest, groups })
    await saveRoom(saved)
    const stored = findGroup(saved, group.id)
    if (!stored) return fail(404, NOT_FOUND_GROUP)
    return ok(toChatView(input.code, stored, input.actor, saved))
  } catch (error) {
    return (
      storeFail(error) ??
      fail(400, error instanceof Error ? error.message : "보내지 못했습니다.")
    )
  }
}

export async function getGroupChatImage(input: {
  code: string
  groupId: string
  messageId: string
  actor: PublicUser
}): Promise<UseCaseResult<{ bytes: Uint8Array; mime: string }>> {
  try {
    const room = await getRoomFresh(input.code)
    if (!room) return fail(404, NOT_FOUND_ROOM)
    const group = findGroup(room, input.groupId)
    if (!group) return fail(404, NOT_FOUND_GROUP)
    if (!canReadGroupChat(group, input.actor.id, isSiteAdmin(input.actor))) {
      return fail(403, FORBIDDEN)
    }
    const message = sanitizeGroupMessages(group.messages).find((item) => item.id === input.messageId)
    if (!message?.image) return fail(404, "사진을 찾을 수 없습니다.")
    const bytes = await loadGroupChatImage({
      code: input.code,
      groupId: group.id,
      messageId: message.id,
    })
    if (!bytes) return fail(404, "사진을 찾을 수 없습니다.")
    return ok({ bytes, mime: message.image.mime })
  } catch (error) {
    return storeFail(error) ?? fail(404, "사진을 찾을 수 없습니다.")
  }
}
