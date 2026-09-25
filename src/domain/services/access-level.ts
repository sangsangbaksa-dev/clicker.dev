import { classFromCode, userBelongsToClass } from "@/shared/classes"
import type { AccessLevel, PublicUser, SchoolLevel } from "@/domain/entities/user"
import type { Room, SchoolNoteKind, Update } from "@/domain/entities/board"

export const WALDO_LOGIN_ID = "waldo"

export const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
  viewer: "뷰어",
  author: "작성자",
  admin: "관리자",
}

export function isWaldoAccount(loginId: string): boolean {
  return loginId.trim().toLowerCase() === WALDO_LOGIN_ID
}

/** Waldo 소유자 계정 */
export function isWaldoOwner(
  user: Pick<PublicUser, "loginId" | "status">
): boolean {
  return user.status === "approved" && isWaldoAccount(user.loginId)
}

export function resolveAccessLevel(user: {
  loginId: string
  accessLevel?: AccessLevel
}): AccessLevel {
  if (isWaldoAccount(user.loginId)) return "admin"
  if (user.accessLevel === "viewer") return "viewer"
  if (user.accessLevel === "admin") return "admin"
  return "author"
}

export function displayAccessLabel(
  user: Pick<PublicUser, "loginId" | "accessLevel" | "contentHold">
): string {
  if (isWaldoAccount(user.loginId)) return "소유자"
  if (user.contentHold) return "뷰어 (심사 대기)"
  return ACCESS_LEVEL_LABELS[resolveAccessLevel(user)]
}

export function accessLevelActionLabel(level: AccessLevel): string {
  return ACCESS_LEVEL_LABELS[level]
}

export function isSiteAdmin(
  user: Pick<PublicUser, "status" | "loginId" | "accessLevel">
): boolean {
  return user.status === "approved" && resolveAccessLevel(user) === "admin"
}

export function canViewBoard(user: Pick<PublicUser, "status">): boolean {
  return user.status === "approved"
}

export function canEditBoard(
  user: Pick<PublicUser, "status" | "loginId" | "accessLevel">
): boolean {
  if (user.status !== "approved") return false
  const level = resolveAccessLevel(user)
  return level === "author" || level === "admin"
}

/** 전교 노트 전체 관리 — 소유자·관리자 */
export function canManageAllSchoolNotes(
  user: Pick<PublicUser, "status" | "loginId" | "accessLevel">
): boolean {
  return isSiteAdmin(user)
}

function schoolNoteKindForLevel(
  subject: "english" | "math",
  level: SchoolLevel
): SchoolNoteKind {
  return `${subject}_${level}` as SchoolNoteKind
}

/** 전교 노트 한 칸 수정 — 소유자·관리자는 전체, 일반 회원은 가입 시 선택한 반만 */
export function canEditSchoolNoteKind(
  user: Pick<
    PublicUser,
    "status" | "loginId" | "accessLevel" | "englishLevel" | "mathLevel"
  >,
  kind: SchoolNoteKind
): boolean {
  if (!canEditBoard(user)) return false
  if (isSiteAdmin(user)) return true
  if (user.englishLevel && kind === schoolNoteKindForLevel("english", user.englishLevel)) {
    return true
  }
  if (user.mathLevel && kind === schoolNoteKindForLevel("math", user.mathLevel)) {
    return true
  }
  return false
}

/** 전교 노트 수정 가능 여부 (한 칸이라도) */
export function canEditSchoolNotes(
  user: Pick<
    PublicUser,
    "status" | "loginId" | "accessLevel" | "englishLevel" | "mathLevel"
  >
): boolean {
  if (!canEditBoard(user)) return false
  if (isSiteAdmin(user)) return true
  return Boolean(user.englishLevel || user.mathLevel)
}

/** user.id is listed in room.members for this class board. */
export function isRoomMember(
  room: Pick<Room, "members">,
  userId: string
): boolean {
  return room.members.some((member) => member.id === userId)
}

/** Site edit permission plus own-class match (site admins bypass class). */
export function canEditRoomContent(
  user: Pick<
    PublicUser,
    "id" | "status" | "loginId" | "accessLevel" | "classN" | "englishLevel" | "mathLevel"
  >,
  room: Pick<Room, "code" | "members">
): boolean {
  if (!canEditBoard(user)) return false
  if (isSiteAdmin(user)) return true
  const info = classFromCode(room.code)
  if (info && userBelongsToClass(user, info)) return true
  return isRoomMember(room, user.id)
}

function isRoomFeedMember(
  user: Pick<
    PublicUser,
    "id" | "status" | "loginId" | "accessLevel" | "classN" | "englishLevel" | "mathLevel"
  >,
  room: Pick<Room, "code" | "members">
): boolean {
  if (user.status !== "approved") return false
  if (isSiteAdmin(user)) return true
  const info = classFromCode(room.code)
  if (info && userBelongsToClass(user, info)) return true
  return isRoomMember(room, user.id)
}

export function canAccessRoomFeed(
  user: Pick<
    PublicUser,
    "id" | "status" | "loginId" | "accessLevel" | "classN" | "englishLevel" | "mathLevel"
  >,
  room: Pick<Room, "code" | "members">
): boolean {
  return isRoomFeedMember(user, room)
}

export function canPostRoomUpdates(
  user: Pick<
    PublicUser,
    "id" | "status" | "loginId" | "accessLevel" | "classN" | "englishLevel" | "mathLevel"
  >,
  room: Pick<Room, "code" | "members">
): boolean {
  if (!isRoomFeedMember(user, room)) return false
  return canEditBoard(user)
}

export function canRemoveRoomUpdate(
  actor: Pick<PublicUser, "id" | "status" | "loginId" | "accessLevel">,
  update: Pick<Update, "authorId">
): boolean {
  if (actor.status !== "approved") return false
  if (isSiteAdmin(actor)) return true
  return Boolean(update.authorId && update.authorId === actor.id)
}

/** Waldo 소유자만 다른 회원을 관리자로 지정·해제 */
export function canAssignAdmin(
  user: Pick<PublicUser, "status" | "loginId">
): boolean {
  return isWaldoOwner(user)
}

/** Waldo 소유자만 회원 퇴원 */
export function canRemoveMembers(
  user: Pick<PublicUser, "status" | "loginId">
): boolean {
  return canAssignAdmin(user)
}

/** 회원 승인 — Waldo 소유자 + 관리자 */
export function canApproveMembers(
  user: Pick<PublicUser, "status" | "loginId" | "accessLevel">
): boolean {
  return isSiteAdmin(user)
}

/** 관리자·소유자는 회원 목록에서 그 사람의 글·수정 기록을 지울 수 있다 */
export function canClearUserRecords(
  user: Pick<PublicUser, "status" | "loginId" | "accessLevel">
): boolean {
  return isSiteAdmin(user)
}

/** 관리자·소유자는 프로필(아이디·반)을 승인 없이 바로 변경 */
export function canDirectProfileChange(
  user: Pick<PublicUser, "status" | "loginId" | "accessLevel">
): boolean {
  return isSiteAdmin(user)
}

/** 뷰어↔작성자 등급 변경 — Waldo 소유자 + 관리자 */
export function canManageMemberLevels(
  user: Pick<PublicUser, "status" | "loginId" | "accessLevel">
): boolean {
  return isSiteAdmin(user)
}

/** @deprecated use canManageMemberLevels */
export function canManageAccessLevels(
  user: Pick<PublicUser, "status" | "loginId" | "accessLevel">
): boolean {
  return canManageMemberLevels(user)
}

export function validateUserRemoval(targetLoginId: string): string | null {
  if (isWaldoAccount(targetLoginId)) {
    return "Waldo 소유자 계정은 퇴원시킬 수 없습니다."
  }
  return null
}

export function validateAccessLevelChange(
  actor: Pick<PublicUser, "status" | "loginId" | "accessLevel">,
  targetLoginId: string,
  targetCurrentLevel: AccessLevel,
  nextLevel: AccessLevel
): string | null {
  if (isWaldoAccount(targetLoginId)) {
    return "Waldo 소유자 계정의 등급은 바꿀 수 없습니다."
  }
  if (nextLevel !== "viewer" && nextLevel !== "author" && nextLevel !== "admin") {
    return "올바르지 않은 등급입니다."
  }
  if (nextLevel === "admin" && !canAssignAdmin(actor)) {
    return "관리자 지정은 Waldo 소유자만 할 수 있습니다."
  }
  if (!canAssignAdmin(actor)) {
    if (targetCurrentLevel === "admin") {
      return "관리자 등급은 Waldo 소유자만 변경할 수 있습니다."
    }
    if (nextLevel !== "viewer" && nextLevel !== "author") {
      return "관리자는 뷰어·작성자 등급만 변경할 수 있습니다."
    }
  }
  return null
}

export function allowedLevelOptions(
  actor: Pick<PublicUser, "status" | "loginId" | "accessLevel">,
  target: Pick<PublicUser, "loginId" | "accessLevel">
): AccessLevel[] {
  if (isWaldoAccount(target.loginId)) return []
  const current = resolveAccessLevel(target)
  if (!canAssignAdmin(actor)) {
    if (current === "admin") return []
    return ["viewer", "author"]
  }
  return ["viewer", "author", "admin"]
}
