import { collectUserActivityMap } from "@/application/activity"
import { fail, ok, type UseCaseResult } from "@/application/result"
import {
  canApproveMembers,
  canClearUserRecords,
  canManageMemberLevels,
  canRemoveMembers,
} from "@/domain/services/access-level"
import { touchRoom } from "@/domain/services/room-mutations"
import {
  addClearedUserRecords,
  clearedUserRecordsCount,
  clearUserRecordsFromRoom,
  clearUserRecordsFromSchoolNotes,
  emptyClearedUserRecords,
  type ClearedUserRecords,
} from "@/domain/services/user-records"
import type { AccessLevel, PublicUser, StoredUser, UserActivityItem } from "@/domain/entities/user"
import {
  getMemberOrder,
  moveMemberInOrder,
  sortMembersByOrder,
} from "@/infrastructure/persistence/member-order"
import { loadRoomDirectory } from "@/infrastructure/persistence/room-directory"
import { clearAllRoomTasks, saveRoom } from "@/infrastructure/persistence/room-repository"
import {
  getSchoolNotesFresh,
  saveSchoolNotes,
  touchSchoolNotes,
} from "@/infrastructure/persistence/school-notes-repository"
import { SharedStoreUnavailableError } from "@/infrastructure/persistence/shared-store-error"
import {
  approveUser,
  findUserById,
  listApprovedMembers,
  listPendingUsers,
  purgeNonWaldoUsers,
  rejectPendingUser,
  releaseContentHold,
  removeUser,
  setUserAccessLevel,
  toPublicUser,
} from "@/infrastructure/persistence/user-repository"
import { recoverSharedSchoolData, type RecoverSharedResult } from "@/infrastructure/persistence/recover-shared-data"
import { CLASSES } from "@/shared/classes"

export async function listPendingWithActivity(_limit = 12) {
  const pending = await listPendingUsers()
  return { pending, activity: {} as Record<string, UserActivityItem[]> }
}

export async function approveMember(
  userId: string,
  approverId: string
): Promise<UseCaseResult<{ user: PublicUser }>> {
  const id = userId.trim()
  if (!id) return fail(400, "승인할 회원을 지정해 주세요.")
  try {
    return ok({ user: await approveUser(id, approverId) })
  } catch (error) {
    return fail(400, error instanceof Error ? error.message : "승인에 실패했습니다.")
  }
}

export async function rejectMember(
  userId: string,
  actor: StoredUser
): Promise<UseCaseResult<{ removed: { loginId: string; name: string } }>> {
  const id = userId.trim()
  if (!id) return fail(400, "거절할 회원을 지정해 주세요.")
  try {
    const removed = await rejectPendingUser(id, actor)
    return ok({ removed })
  } catch (error) {
    return fail(400, error instanceof Error ? error.message : "거절에 실패했습니다.")
  }
}

export async function listMembersWithActivity(actor: PublicUser, limit = 12) {
  const members = await listApprovedMembers()
  const order = await getMemberOrder()
  const sorted = sortMembersByOrder(members, order)
  const held = sorted.filter((member) => member.contentHold)
  const rest = sorted.filter((member) => !member.contentHold)
  const ordered = [...held, ...rest]
  const activity = await collectUserActivityMap(
    ordered.map((u) => u.id),
    limit
  )
  return {
    members: ordered,
    order,
    canReorder: canManageMemberLevels(actor),
    activity,
  }
}

export async function reorderMember(input: {
  actor: PublicUser
  userId?: string
  direction?: "up" | "down"
}): Promise<
  UseCaseResult<{ members: PublicUser[]; order: string[] }>
> {
  if (!canManageMemberLevels(input.actor)) {
    return fail(403, "회원 순서는 소유자·관리자만 변경할 수 있습니다.")
  }
  if (!input.userId || (input.direction !== "up" && input.direction !== "down")) {
    return fail(400, "잘못된 요청입니다.")
  }
  try {
    const members = await listApprovedMembers()
    const order = await moveMemberInOrder(members, input.userId, input.direction)
    return ok({ members: sortMembersByOrder(members, order), order })
  } catch (error) {
    return fail(400, error instanceof Error ? error.message : "순서 변경에 실패했습니다.")
  }
}

export async function approveContentHold(input: {
  userId?: string
  actor: StoredUser
}): Promise<UseCaseResult<{ user: PublicUser }>> {
  const userId = input.userId?.trim() ?? ""
  if (!userId) return fail(400, "허가할 회원을 지정해 주세요.")
  try {
    return ok({ user: await releaseContentHold(userId, input.actor) })
  } catch (error) {
    return fail(400, error instanceof Error ? error.message : "허가에 실패했습니다.")
  }
}

export async function changeAccessLevel(input: {
  userId?: string
  accessLevel?: AccessLevel
  actor: StoredUser
}): Promise<UseCaseResult<{ user: PublicUser; refreshSession: boolean }>> {
  const userId = input.userId?.trim() ?? ""
  if (!userId || !input.accessLevel) {
    return fail(400, "회원과 등급을 지정해 주세요.")
  }
  try {
    const user = await setUserAccessLevel(userId, input.accessLevel, input.actor)
    return ok({ user, refreshSession: userId === input.actor.id })
  } catch (error) {
    return fail(400, error instanceof Error ? error.message : "등급 변경에 실패했습니다.")
  }
}

export async function clearMemberRecords(input: {
  actor: PublicUser
  userId?: string
}): Promise<UseCaseResult<{ cleared: ClearedUserRecords }>> {
  if (!canClearUserRecords(input.actor)) {
    return fail(403, "기록 삭제는 관리자만 할 수 있습니다.")
  }
  const userId = input.userId?.trim() ?? ""
  if (!userId) return fail(400, "기록을 지울 회원을 지정해 주세요.")

  try {
    const target = await findUserById(userId)
    if (!target) return fail(404, "회원을 찾을 수 없습니다.")

    let cleared = emptyClearedUserRecords()
    const { dir, unreliable, confirmedEmpty } = await loadRoomDirectory({ fresh: true })
    if (unreliable && Object.keys(dir.rooms).length === 0 && !confirmedEmpty) {
      throw new SharedStoreUnavailableError()
    }

    for (const info of CLASSES) {
      const room = dir.rooms[info.code]
      if (!room) continue
      const next = clearUserRecordsFromRoom(room, userId)
      if (clearedUserRecordsCount(next.cleared) === 0) continue
      await saveRoom(touchRoom(next.room))
      cleared = addClearedUserRecords(cleared, next.cleared)
    }

    const school = await getSchoolNotesFresh()
    const schoolNext = clearUserRecordsFromSchoolNotes(school, userId)
    if (clearedUserRecordsCount(schoolNext.cleared) > 0) {
      await saveSchoolNotes(touchSchoolNotes(schoolNext.doc))
      cleared = addClearedUserRecords(cleared, schoolNext.cleared)
    }

    return ok({ cleared })
  } catch (error) {
    if (error instanceof SharedStoreUnavailableError) {
      return fail(503, error.message)
    }
    return fail(400, error instanceof Error ? error.message : "기록을 삭제하지 못했습니다.")
  }
}

export async function removeMember(
  userId: string,
  actor: StoredUser
): Promise<UseCaseResult<{ removed: { loginId: string; name: string } }>> {
  const id = userId.trim()
  if (!id) return fail(400, "퇴원시킬 회원을 지정해 주세요.")
  try {
    const removed = await removeUser(id, actor)
    return ok({ removed })
  } catch (error) {
    if (error instanceof SharedStoreUnavailableError) {
      return fail(503, error.message)
    }
    return fail(400, error instanceof Error ? error.message : "회원 퇴원에 실패했습니다.")
  }
}

export async function purgeNonWaldoSchool(
  actor: StoredUser
): Promise<
  UseCaseResult<{
    removed: Array<{ loginId: string; name: string }>
    tasksCleared: number
  }>
> {
  if (!canRemoveMembers(toPublicUser(actor))) {
    return fail(403, "일괄 정리는 Waldo 소유자만 할 수 있습니다.")
  }
  try {
    const { removed } = await purgeNonWaldoUsers(actor)
    const tasksCleared = await clearAllRoomTasks()
    return ok({ removed, tasksCleared })
  } catch (error) {
    if (error instanceof SharedStoreUnavailableError) {
      return fail(503, error.message)
    }
    return fail(400, error instanceof Error ? error.message : "일괄 정리에 실패했습니다.")
  }
}

export async function recoverLostMembers(
  actor: PublicUser
): Promise<UseCaseResult<RecoverSharedResult>> {
  if (!canApproveMembers(actor)) {
    return fail(403, "회원 복구는 관리자만 할 수 있습니다.")
  }
  try {
    return ok(await recoverSharedSchoolData())
  } catch (error) {
    if (error instanceof SharedStoreUnavailableError) {
      return fail(503, error.message)
    }
    return fail(400, error instanceof Error ? error.message : "회원을 복구하지 못했습니다.")
  }
}
