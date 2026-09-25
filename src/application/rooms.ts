import { rejectDisallowedContent } from "@/application/moderation"
import { recordNotesHistory, sanitizeNotesHistory } from "@/application/notes-history"
import { fail, ok, type UseCaseResult } from "@/application/result"
import {
  canEditRoomContent,
  canPostRoomUpdates,
  canRemoveRoomUpdate,
  isSiteAdmin,
} from "@/domain/services/access-level"
import {
  applyMemberPresence,
  appendRoomUpdate,
  removeRoomUpdate,
  sanitizeRoomFields,
  touchRoom,
} from "@/domain/services/room-mutations"
import {
  normalizeSubjectNotes,
  sanitizeSubjectNotes,
  syncLegacyNotesField,
} from "@/domain/services/subject-notes"
import type { Member, Room } from "@/domain/entities/board"
import type { PublicUser } from "@/domain/entities/user"
import { stampRoomAuthors } from "@/infrastructure/auth/attribution"
import {
  cacheMemberPresence,
  getRoomFresh,
  saveRoom,
} from "@/infrastructure/persistence/room-repository"
import { SharedStoreUnavailableError } from "@/infrastructure/persistence/shared-store-error"
import { addedTexts } from "@/domain/services/content-moderation"
import { roomWithoutGroupDocuments } from "@/domain/services/group-docs"
import { classFromCode, userBelongsToClass } from "@/shared/classes"

const NOT_FOUND = "화산중을 찾을 수 없습니다."
const CONFLICT = "다른 친구가 먼저 저장했습니다."
const STORE_UNAVAILABLE = "반 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."

function storeFail<T>(error: unknown): UseCaseResult<T> | null {
  if (error instanceof SharedStoreUnavailableError) {
    return fail(503, error.message || STORE_UNAVAILABLE)
  }
  return null
}

function publicRoom(room: Room): Room {
  return roomWithoutGroupDocuments(room)
}

function collectRoomTexts(room: Room): string[] {
  const texts = [
    room.title,
    room.subject,
    room.description,
    room.notes,
    ...Object.values(room.subjectNotes ?? {}),
  ]
  for (const task of room.tasks ?? []) {
    texts.push(task.title, task.notes)
    for (const comment of task.comments ?? []) {
      texts.push(comment.text)
    }
  }
  for (const update of room.updates ?? []) {
    texts.push(update.text)
  }
  for (const group of room.groups ?? []) {
    texts.push(group.name)
  }
  return texts.filter((item): item is string => Boolean(item && String(item).trim()))
}

function sanitizeRoomInput(input: Room, previous: Room): Room {
  return {
    ...sanitizeRoomFields(input, previous),
    ...syncLegacyNotesField(
      sanitizeSubjectNotes(
        normalizeSubjectNotes(input.subjectNotes, String(input.notes ?? previous.notes))
      )
    ),
    notesHistory: sanitizeNotesHistory(previous),
  }
}

export async function getRoomQuery(input: {
  code: string
  clientRevision?: number | null
}): Promise<
  UseCaseResult<
    | { kind: "full"; room: Room }
    | { kind: "unchanged"; revision: number; members: Member[] }
  >
> {
  try {
    const room = await getRoomFresh(input.code)
    if (!room) return fail(404, NOT_FOUND)
    if (input.clientRevision != null && input.clientRevision === room.revision) {
      return ok({ kind: "unchanged", revision: room.revision, members: room.members })
    }
    return ok({ kind: "full", room: publicRoom(room) })
  } catch (error) {
    return storeFail(error) ?? fail(400, error instanceof Error ? error.message : NOT_FOUND)
  }
}

export async function saveRoomContent(input: {
  code: string
  incoming: Room
  clientRevision: number
  actor: PublicUser
}): Promise<UseCaseResult<{ room: Room }>> {
  try {
    const current = await getRoomFresh(input.code)
    if (!current) return fail(404, NOT_FOUND)
    if (!canEditRoomContent(input.actor, current)) {
      return fail(403, "이 반에 속한 회원만 내용을 수정할 수 있습니다.")
    }
    if (input.clientRevision !== current.revision) {
      return fail(409, CONFLICT, { conflict: true, payload: { room: publicRoom(current) } })
    }

    const blocked = await rejectDisallowedContent(
      input.actor,
      addedTexts(collectRoomTexts(current), collectRoomTexts(input.incoming))
    )
    if (blocked) return blocked
    const sanitized = sanitizeRoomInput(input.incoming, current)
    const attributed = stampRoomAuthors(sanitized, current, input.actor)
    const merged = touchRoom({
      ...recordNotesHistory(attributed, current, input.actor),
      members: current.members,
    })
    await saveRoom(merged)
    return ok({ room: publicRoom(merged) })
  } catch (error) {
    return (
      storeFail(error) ??
      fail(400, error instanceof Error ? error.message : "저장하지 못했습니다.")
    )
  }
}

export type PatchRoomInput =
  | { type: "post-update"; code: string; text: string; actor: PublicUser }
  | { type: "remove-update"; code: string; updateId: string; actor: PublicUser }
  | { type: "heartbeat" | "join"; code: string; actor: PublicUser }

export async function patchRoom(
  input: PatchRoomInput
): Promise<
  UseCaseResult<
    | { kind: "room"; room: Room }
    | { kind: "members"; members: Member[]; revision: number }
  >
> {
  try {
    const fresh = await getRoomFresh(input.code)
    if (!fresh) return fail(404, NOT_FOUND)

    if (input.type === "post-update") {
      if (!canPostRoomUpdates(input.actor, fresh)) {
        return fail(403, "이 반 회원만 소식을 올릴 수 있습니다.")
      }
      const blocked = await rejectDisallowedContent(input.actor, [input.text])
      if (blocked) return blocked
      const next = appendRoomUpdate(fresh, input.actor, input.text)
      await saveRoom(next)
      return ok({ kind: "room", room: publicRoom(next) })
    }

    if (input.type === "remove-update") {
      const updateId = input.updateId.trim()
      if (!updateId) return fail(400, "삭제할 소식을 찾을 수 없습니다.")
      const target = fresh.updates.find((item) => item.id === updateId)
      if (!target) return fail(404, "소식을 찾을 수 없습니다.")
      if (!canRemoveRoomUpdate(input.actor, target)) {
        return fail(403, "본인이 쓴 소식만 지울 수 있습니다.")
      }
      const next = removeRoomUpdate(fresh, updateId)
      await saveRoom(next)
      return ok({ kind: "room", room: publicRoom(next) })
    }

    const nowMs = Date.now()
    const session = { id: input.actor.id, name: input.actor.name }
    const alreadyMember = fresh.members.some((m) => m.id === input.actor.id)

    const classInfo = classFromCode(input.code)
    if (
      input.type === "join" &&
      !alreadyMember &&
      classInfo &&
      !isSiteAdmin(input.actor) &&
      !userBelongsToClass(input.actor, classInfo)
    ) {
      const cached = cacheMemberPresence(fresh, fresh.members)
      return ok({ kind: "members", members: cached.members, revision: cached.revision })
    }

    const presence = applyMemberPresence(fresh, session, input.type, nowMs)
    if (presence.full) return fail(400, "이 방은 정원이 가득 찼습니다.")

    if (input.type === "heartbeat" && !presence.joined && !presence.persist) {
      const cached = cacheMemberPresence(fresh, presence.members)
      return ok({ kind: "members", members: cached.members, revision: cached.revision })
    }

    const latest = await getRoomFresh(input.code)
    if (!latest) return fail(404, NOT_FOUND)

    const latestPresence = applyMemberPresence(latest, session, input.type, nowMs)
    if (latestPresence.full) return fail(400, "이 방은 정원이 가득 찼습니다.")

    const next = latestPresence.joined
      ? touchRoom({ ...latest, members: latestPresence.members, updates: latestPresence.updates })
      : { ...latest, members: latestPresence.members }

    await saveRoom(next)
    return ok({ kind: "room", room: publicRoom(next) })
  } catch (error) {
    return (
      storeFail(error) ??
      fail(400, error instanceof Error ? error.message : "요청을 처리하지 못했습니다.")
    )
  }
}
