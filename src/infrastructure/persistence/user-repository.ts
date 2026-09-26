import { selectUsersToPurge } from "@/domain/services/member-purge"
import {
  canApproveMembers,
  canAssignAdmin,
  canManageMemberLevels,
  canRemoveMembers,
  isWaldoAccount,
  resolveAccessLevel,
  validateAccessLevelChange,
  validateUserRemoval,
} from "@/domain/services/access-level"
import { hashPassword } from "@/infrastructure/auth/password"
import { isClassNumber } from "@/shared/classes"
import type {
  AccessLevel,
  ClassNumber,
  ProfileChanges,
  PublicUser,
  SchoolLevel,
  StoredUser,
  UserStatus,
} from "@/domain/entities/user"
import { validateSchoolLevel } from "@/domain/services/school-note-kinds"
import {
  isExpelledLoginId,
  recordRemovedAccount,
  type RemovedAccountReason,
} from "@/infrastructure/persistence/removed-accounts"
import { createId } from "@/shared/ids"
import { removeMemberFromOrder } from "@/infrastructure/persistence/member-order"
import { mergePendingUsers } from "@/infrastructure/persistence/shared-merge"
import {
  invalidateUserDirectory,
  loadUserDirectory,
  saveUserDirectory,
} from "@/infrastructure/persistence/user-directory"
import {
  forgetPendingSignup,
  rememberPendingSignup,
} from "@/infrastructure/persistence/pending-signups"

const USER_CACHE_TTL_MS = 8_000
const BOOTSTRAP_CACHE_TTL_MS = 30_000
const REGISTERED_IDS_CACHE_TTL_MS = 8_000

type CachedUser = { user: StoredUser; loadedAt: number }

const userCache = new Map<string, CachedUser>()
let bootstrapCache: {
  loadedAt: number
  needsFirstMember: boolean
  approvedCount: number
} | null = null
let registeredIdsCache: { loadedAt: number; ids: Set<string> } | null = null

function invalidateUserCaches(userId?: string) {
  if (userId) {
    userCache.delete(userId)
  } else {
    userCache.clear()
  }
  bootstrapCache = null
  registeredIdsCache = null
  invalidateUserDirectory()
}

function normalizeLoginId(loginId: string): string {
  return loginId.trim().toLowerCase()
}

function normalizeStoredUser(user: StoredUser): StoredUser {
  const status: UserStatus = userIsApproved(user) ? "approved" : "pending"
  const accessLevel = resolveAccessLevel(user)
  return {
    ...user,
    status,
    accessLevel,
  }
}

/** 승인된 회원만 true. pending은 false. status 없는 예전 계정은 approved로 취급. */
export function userIsApproved(user: StoredUser): boolean {
  if (user.status === "pending") return false
  return user.status === "approved" || user.status === undefined
}

export function toPublicUser(user: StoredUser): PublicUser {
  const normalized = normalizeStoredUser(user)
  return {
    id: normalized.id,
    loginId: normalized.loginId,
    name: normalized.name,
    status: normalized.status,
    accessLevel: normalized.accessLevel ?? resolveAccessLevel(normalized),
    classN: normalized.classN,
    englishLevel: normalized.englishLevel,
    mathLevel: normalized.mathLevel,
    contentHold: normalized.contentHold,
  }
}

type UserIndex = Record<string, string>

async function readIndex(): Promise<UserIndex> {
  const dir = await loadUserDirectory()
  return dir.index
}

async function writeIndex(index: UserIndex, removedLoginIds: string[] = []): Promise<void> {
  const dir = await loadUserDirectory()
  const nextIndex = { ...dir.index, ...index }
  for (const loginId of removedLoginIds) {
    delete nextIndex[loginId]
  }
  await saveUserDirectory({ ...dir, index: nextIndex })
}

async function readUser(userId: string): Promise<StoredUser | null> {
  const dir = await loadUserDirectory()
  const user = dir.users[userId]
  return user ? normalizeStoredUser(user) : null
}

async function writeUser(user: StoredUser, previousLoginId?: string): Promise<void> {
  const dir = await loadUserDirectory()
  const normalized = normalizeStoredUser(user)
  const users = { ...dir.users, [normalized.id]: normalized }
  const index = { ...dir.index }
  if (previousLoginId) {
    delete index[normalizeLoginId(previousLoginId)]
  }
  index[normalizeLoginId(normalized.loginId)] = normalized.id
  const pending =
    normalized.status === "pending"
      ? mergePendingUsers([dir.pending, [normalized]])
      : dir.pending.filter((item) => item.id !== normalized.id)
  await saveUserDirectory({ ...dir, users, index, pending })
  userCache.set(normalized.id, { user: normalized, loadedAt: Date.now() })
  bootstrapCache = null
}

async function deleteUserRecord(userId: string): Promise<void> {
  const dir = await loadUserDirectory()
  const users = { ...dir.users }
  delete users[userId]
  const index = { ...dir.index }
  for (const [loginId, id] of Object.entries(index)) {
    if (id === userId) delete index[loginId]
  }
  await saveUserDirectory({
    ...dir,
    users,
    index,
    pending: dir.pending.filter((user) => user.id !== userId),
    deletedIds: [...new Set([...dir.deletedIds, userId])],
  })
  userCache.delete(userId)
}

export function validateLoginId(loginId: string): string | null {
  const trimmed = loginId.trim()
  if (trimmed.length < 3 || trimmed.length > 20) {
    return "아이디는 3~20자여야 합니다."
  }
  if (!/^[a-zA-Z0-9_가-힣]+$/.test(trimmed)) {
    return "아이디는 글자, 숫자, 밑줄만 쓸 수 있습니다."
  }
  return null
}

export function validateName(name: string): string | null {
  const trimmed = name.trim()
  if (trimmed.length < 2 || trimmed.length > 20) {
    return "이름은 2~20자여야 합니다."
  }
  return null
}

export function validatePassword(password: string): string | null {
  if (password.length < 6) {
    return "비밀번호는 6자 이상이어야 합니다."
  }
  if (password.length > 72) {
    return "비밀번호가 너무 깁니다."
  }
  return null
}

export function validateClassN(classN: unknown): classN is ClassNumber {
  return typeof classN === "number" && isClassNumber(classN)
}

export function classNValidationError(classN: unknown): string | null {
  if (validateClassN(classN)) return null
  return "반을 선택해 주세요. (1반, 2반, 3반, 4반 중 하나)"
}

export function validateUserSchoolLevel(level: unknown): level is SchoolLevel {
  return validateSchoolLevel(level)
}

export function userSchoolLevelValidationError(
  level: unknown,
  subject: "영어" | "수학"
): string | null {
  if (validateSchoolLevel(level)) return null
  return `${subject} 반을 선택해 주세요. (S반, A, B, C, D, E반 중 하나)`
}

export async function findUserByLoginId(loginId: string): Promise<StoredUser | null> {
  const normalized = normalizeLoginId(loginId)
  if (!normalized) return null
  const index = await readIndex()
  const userId = index[normalized]
  if (!userId) return null
  return readUser(userId)
}

export async function findUserById(userId: string): Promise<StoredUser | null> {
  const cached = userCache.get(userId)
  if (cached && Date.now() - cached.loadedAt < USER_CACHE_TTL_MS) {
    return cached.user
  }
  const user = await readUser(userId)
  if (!user) return null
  userCache.set(userId, { user, loadedAt: Date.now() })
  return user
}

export async function listAllUsers(): Promise<StoredUser[]> {
  const dir = await loadUserDirectory()
  return Object.values(dir.users)
    .filter((user) => !dir.deletedIds.includes(user.id))
    .map(normalizeStoredUser)
}

export async function listPendingUsers(): Promise<PublicUser[]> {
  const dir = await loadUserDirectory()
  return dir.pending
    .map(normalizeStoredUser)
    .map(toPublicUser)
    .sort((a, b) => a.loginId.localeCompare(b.loginId, "ko"))
}

export async function countApprovedUsers(): Promise<number> {
  const users = await listAllUsers()
  return users.filter(userIsApproved).length
}

/** 소유자 시드가 항상 승인 상태이므로 첫 가입 자동승인은 쓰지 않는다. */
export async function needsFirstMember(): Promise<boolean> {
  return false
}

export async function getBootstrapInfo(): Promise<{
  needsFirstMember: boolean
  approvedCount: number
}> {
  if (
    bootstrapCache &&
    Date.now() - bootstrapCache.loadedAt < BOOTSTRAP_CACHE_TTL_MS
  ) {
    return {
      needsFirstMember: bootstrapCache.needsFirstMember,
      approvedCount: bootstrapCache.approvedCount,
    }
  }
  const info = { needsFirstMember: false, approvedCount: 1 }
  bootstrapCache = { loadedAt: Date.now(), ...info }
  return info
}

export async function createUser(input: {
  loginId: string
  name: string
  password: string
  classN: ClassNumber
  englishLevel: SchoolLevel
  mathLevel: SchoolLevel
}): Promise<{ user: PublicUser; autoApproved: boolean }> {
  const loginIdError = validateLoginId(input.loginId)
  if (loginIdError) throw new Error(loginIdError)
  const nameError = validateName(input.name)
  if (nameError) throw new Error(nameError)
  const passwordError = validatePassword(input.password)
  if (passwordError) throw new Error(passwordError)
  const classError = classNValidationError(input.classN)
  if (classError) throw new Error(classError)
  const englishError = userSchoolLevelValidationError(input.englishLevel, "영어")
  if (englishError) throw new Error(englishError)
  const mathError = userSchoolLevelValidationError(input.mathLevel, "수학")
  if (mathError) throw new Error(mathError)

  const normalized = normalizeLoginId(input.loginId)
  const index = await readIndex()
  if (index[normalized]) {
    throw new Error("이미 사용 중인 아이디입니다.")
  }
  if (await isExpelledLoginId(input.loginId)) {
    throw new Error("퇴출당한 계정입니다.")
  }

  const autoApproved = await needsFirstMember()
  const status: UserStatus = autoApproved ? "approved" : "pending"
  const now = new Date().toISOString()

  const user: StoredUser = {
    id: createId("usr"),
    loginId: input.loginId.trim(),
    name: input.name.trim(),
    passwordHash: await hashPassword(input.password),
    status,
    accessLevel: "author",
    classN: input.classN,
    englishLevel: input.englishLevel,
    mathLevel: input.mathLevel,
    approvedAt: autoApproved ? now : undefined,
    createdAt: now,
  }

  index[normalized] = user.id
  await writeUser(user)
  await writeIndex(index)
  if (user.status === "pending") {
    await rememberPendingSignup(user)
  }
  invalidateUserCaches()

  if (autoApproved) {
    const approved = (await listAllUsers()).filter(userIsApproved)
    if (approved.length > 1) {
      const first = [...approved].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt)
      )[0]
      if (first.id !== user.id) {
        const pendingUser: StoredUser = {
          ...user,
          status: "pending",
          approvedAt: undefined,
        }
        await writeUser(pendingUser)
        await rememberPendingSignup(pendingUser)
        invalidateUserCaches()
        return { user: toPublicUser(pendingUser), autoApproved: false }
      }
    }
  }

  return { user: toPublicUser(user), autoApproved }
}

export async function approveUser(
  userId: string,
  approverId: string
): Promise<PublicUser> {
  const target = await findUserById(userId)
  if (!target) {
    throw new Error("사용자를 찾을 수 없습니다.")
  }
  if (target.status === "approved") {
    throw new Error("이미 승인된 회원입니다.")
  }

  const approver = await findUserById(approverId)
  if (!approver || !canApproveMembers(toPublicUser(approver))) {
    throw new Error("회원 승인은 관리자만 할 수 있습니다.")
  }

  const now = new Date().toISOString()
  const updated: StoredUser = normalizeStoredUser({
    ...target,
    status: "approved",
    accessLevel: target.accessLevel ?? "author",
    approvedBy: approverId,
    approvedAt: now,
  })
  await writeUser(updated)
  await forgetPendingSignup(userId)
  invalidateUserCaches(userId)
  return toPublicUser(updated)
}

export async function listApprovedMembers(): Promise<PublicUser[]> {
  const users = await listAllUsers()
  return users.filter(userIsApproved).map(toPublicUser)
}

export async function setUserAccessLevel(
  targetUserId: string,
  accessLevel: AccessLevel,
  actor: StoredUser
): Promise<PublicUser> {
  if (!canManageMemberLevels(toPublicUser(actor))) {
    throw new Error("회원 등급을 변경할 권한이 없습니다.")
  }

  const target = await findUserById(targetUserId)
  if (!target) {
    throw new Error("사용자를 찾을 수 없습니다.")
  }
  if (!userIsApproved(target)) {
    throw new Error("승인된 회원만 등급을 변경할 수 있습니다.")
  }

  const targetPublic = toPublicUser(target)
  const levelError = validateAccessLevelChange(
    toPublicUser(actor),
    target.loginId,
    targetPublic.accessLevel,
    accessLevel
  )
  if (levelError) {
    throw new Error(levelError)
  }

  const updated = normalizeStoredUser({
    ...target,
    accessLevel,
    contentHold: undefined,
  })
  delete updated.contentHold
  await writeUser(updated)
  invalidateUserCaches(targetUserId)
  return toPublicUser(updated)
}

export async function applyContentHold(
  userId: string,
  snippet: string
): Promise<PublicUser | null> {
  const user = await findUserById(userId)
  if (!user) return null
  if (isWaldoAccount(user.loginId)) return toPublicUser(user)
  if (!userIsApproved(user)) return toPublicUser(user)

  const current = resolveAccessLevel(user)
  const previousLevel = user.contentHold?.previousLevel ?? current
  const updated = normalizeStoredUser({
    ...user,
    accessLevel: "viewer",
    contentHold: {
      previousLevel,
      reason: "disallowed-content",
      snippet: snippet.trim().slice(0, 80),
      createdAt: user.contentHold?.createdAt ?? new Date().toISOString(),
    },
  })
  await writeUser(updated)
  invalidateUserCaches(userId)
  return toPublicUser(updated)
}

export async function releaseContentHold(
  targetUserId: string,
  actor: StoredUser
): Promise<PublicUser> {
  if (!canManageMemberLevels(toPublicUser(actor))) {
    throw new Error("내용 허가는 소유자·관리자만 할 수 있습니다.")
  }

  const target = await findUserById(targetUserId)
  if (!target) {
    throw new Error("사용자를 찾을 수 없습니다.")
  }
  if (!target.contentHold) {
    throw new Error("심사 대기 중인 회원이 아닙니다.")
  }

  let restoreLevel = target.contentHold.previousLevel
  const levelError = validateAccessLevelChange(
    toPublicUser(actor),
    target.loginId,
    "viewer",
    restoreLevel
  )
  if (levelError) {
    if (restoreLevel === "admin" && !canAssignAdmin(toPublicUser(actor))) {
      restoreLevel = "author"
    } else {
      throw new Error(levelError)
    }
  }

  const updated = normalizeStoredUser({
    ...target,
    accessLevel: restoreLevel,
    contentHold: undefined,
  })
  delete updated.contentHold
  await writeUser(updated)
  invalidateUserCaches(targetUserId)
  return toPublicUser(updated)
}

export async function applyProfileChanges(
  userId: string,
  changes: ProfileChanges
): Promise<PublicUser> {
  const user = await findUserById(userId)
  if (!user) {
    throw new Error("사용자를 찾을 수 없습니다.")
  }
  if (
    isWaldoAccount(user.loginId) &&
    changes.loginId &&
    normalizeLoginId(changes.loginId) !== normalizeLoginId(user.loginId)
  ) {
    throw new Error("Waldo 소유자 계정의 아이디는 바꿀 수 없습니다.")
  }

  let nextLoginId = user.loginId
  let nextClassN = user.classN
  let nextEnglishLevel = user.englishLevel
  let nextMathLevel = user.mathLevel

  if (changes.loginId !== undefined) {
    const trimmed = changes.loginId.trim()
    const loginIdError = validateLoginId(trimmed)
    if (loginIdError) throw new Error(loginIdError)
    if (normalizeLoginId(trimmed) !== normalizeLoginId(user.loginId)) {
      const existing = await findUserByLoginId(trimmed)
      if (existing && existing.id !== userId) {
        throw new Error("이미 사용 중인 아이디입니다.")
      }
      nextLoginId = trimmed
    }
  }

  if (changes.classN !== undefined) {
    const classError = classNValidationError(changes.classN)
    if (classError) throw new Error(classError)
    nextClassN = changes.classN
  }

  if (changes.englishLevel !== undefined) {
    const englishError = userSchoolLevelValidationError(changes.englishLevel, "영어")
    if (englishError) throw new Error(englishError)
    nextEnglishLevel = changes.englishLevel
  }

  if (changes.mathLevel !== undefined) {
    const mathError = userSchoolLevelValidationError(changes.mathLevel, "수학")
    if (mathError) throw new Error(mathError)
    nextMathLevel = changes.mathLevel
  }

  if (
    nextLoginId === user.loginId &&
    nextClassN === user.classN &&
    nextEnglishLevel === user.englishLevel &&
    nextMathLevel === user.mathLevel
  ) {
    throw new Error("변경할 내용이 없습니다.")
  }

  const updated = normalizeStoredUser({
    ...user,
    loginId: nextLoginId,
    classN: nextClassN,
    englishLevel: nextEnglishLevel,
    mathLevel: nextMathLevel,
  })
  await writeUser(updated, user.loginId)
  invalidateUserCaches(userId)
  return toPublicUser(updated)
}

/** Registered account ids (for pruning stale room members). */
export async function getRegisteredUserIds(): Promise<Set<string>> {
  if (
    registeredIdsCache &&
    Date.now() - registeredIdsCache.loadedAt < REGISTERED_IDS_CACHE_TTL_MS
  ) {
    return registeredIdsCache.ids
  }
  const index = await readIndex()
  const ids = new Set(Object.values(index))
  registeredIdsCache = { loadedAt: Date.now(), ids }
  return ids
}

async function deleteUserAccount(
  target: StoredUser,
  reason: RemovedAccountReason
): Promise<{ loginId: string; name: string }> {
  const removalError = validateUserRemoval(target.loginId)
  if (removalError) {
    throw new Error(removalError)
  }

  await recordRemovedAccount({
    loginId: target.loginId,
    passwordHash: target.passwordHash,
    reason,
  })

  const { removeMemberFromAllRooms } = await import("@/infrastructure/persistence/room-repository")
  await removeMemberFromAllRooms(target.id)

  await deleteUserRecord(target.id)
  await removeMemberFromOrder(target.id)
  await forgetPendingSignup(target.id)
  invalidateUserCaches(target.id)
  return { loginId: target.loginId, name: target.name }
}

/** 승인 대기 가입 신청 거절 — 관리자·소유자 */
export async function rejectPendingUser(
  targetUserId: string,
  actor: StoredUser
): Promise<{ loginId: string; name: string }> {
  if (!canApproveMembers(toPublicUser(actor))) {
    throw new Error("관리자만 가입 신청을 거절할 수 있습니다.")
  }

  const target = await findUserById(targetUserId)
  if (!target) {
    throw new Error("사용자를 찾을 수 없습니다.")
  }
  if (target.status !== "pending") {
    throw new Error("승인 대기 중인 회원만 거절할 수 있습니다.")
  }

  return deleteUserAccount(target, "rejected")
}

export async function removeUser(
  targetUserId: string,
  actor: StoredUser
): Promise<{ loginId: string; name: string }> {
  if (!canRemoveMembers(toPublicUser(actor))) {
    throw new Error("회원 퇴원은 Waldo 소유자만 할 수 있습니다.")
  }
  if (actor.id === targetUserId) {
    throw new Error("본인 계정은 퇴원시킬 수 없습니다.")
  }

  const target = await findUserById(targetUserId)
  if (!target) {
    throw new Error("사용자를 찾을 수 없습니다.")
  }
  if (target.status === "pending") {
    throw new Error("가입 거절은 회원 승인 화면에서 해 주세요.")
  }

  return deleteUserAccount(target, "expelled")
}

export async function purgeNonWaldoUsers(
  actor: StoredUser
): Promise<{ removed: Array<{ loginId: string; name: string }> }> {
  if (!canRemoveMembers(toPublicUser(actor))) {
    throw new Error("회원 일괄 퇴출은 Waldo 소유자만 할 수 있습니다.")
  }

  const removed: Array<{ loginId: string; name: string }> = []
  const targets = selectUsersToPurge(await listAllUsers()).filter((user) => user.id !== actor.id)
  for (const target of targets) {
    removed.push(await deleteUserAccount(target, "expelled"))
  }
  invalidateUserCaches()
  return { removed }
}
