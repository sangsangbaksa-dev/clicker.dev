import { canApproveMembers, isWaldoAccount } from "@/domain/services/access-level"
import type {
  ProfileChangeRequest,
  ProfileChanges,
  StoredUser,
} from "@/domain/entities/user"
import {
  applyProfileChanges,
  classNValidationError,
  findUserById,
  findUserByLoginId,
  toPublicUser,
  userSchoolLevelValidationError,
  validateLoginId,
} from "@/infrastructure/persistence/user-repository"
import { createId } from "@/shared/ids"
import {
  mergeProfileRequests,
  type ProfileRequestDirectory,
} from "@/infrastructure/persistence/shared-merge"
import {
  readJsonFile,
  readSharedLayers,
  rememberSnapshot,
  sharedFilePath,
  writeJsonFile,
  writeSharedJson,
} from "@/infrastructure/persistence/shared-json-store"

const REQUESTS_FILE = sharedFilePath("profile-requests", "pending.json")
const REQUESTS_KEY = "profile-requests-pending"
const NETLIFY_STORE = "sohaengbang-users"

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

function asDirectory(
  raw: ProfileRequestDirectory | ProfileChangeRequest[] | null
): ProfileRequestDirectory | null {
  if (!raw) return null
  if (Array.isArray(raw)) {
    return { requests: raw, deletedIds: [], updatedAt: "" }
  }
  return {
    requests: Array.isArray(raw.requests) ? raw.requests : [],
    deletedIds: Array.isArray(raw.deletedIds) ? raw.deletedIds : [],
    updatedAt: String(raw.updatedAt ?? ""),
  }
}

async function readFromNetlify(): Promise<ProfileRequestDirectory | null> {
  if (!shouldUseNetlifyBlobs()) return null
  try {
    const store = await netlifyStore()
    const value = await store.get(REQUESTS_KEY, { type: "json" })
    return asDirectory(value as ProfileRequestDirectory | ProfileChangeRequest[] | null)
  } catch {
    return null
  }
}

async function readDirectory(): Promise<ProfileRequestDirectory> {
  const layers = await readSharedLayers<ProfileRequestDirectory | ProfileChangeRequest[]>(
    REQUESTS_KEY,
    async () => asDirectory(await readJsonFile(REQUESTS_FILE))
  )
  const netlify = await readFromNetlify()
  const doc = mergeProfileRequests([
    asDirectory(layers.file),
    asDirectory(layers.blob),
    asDirectory(layers.cache),
    asDirectory(layers.snapshot),
    netlify,
  ])
  rememberSnapshot(REQUESTS_KEY, doc)
  return doc
}

async function writeDirectory(doc: ProfileRequestDirectory): Promise<void> {
  const current = await readDirectory()
  const merged = mergeProfileRequests([current, doc])
  rememberSnapshot(REQUESTS_KEY, merged)
  await writeSharedJson(REQUESTS_KEY, merged, () => writeJsonFile(REQUESTS_FILE, merged))
  if (shouldUseNetlifyBlobs()) {
    try {
      const store = await netlifyStore()
      await store.setJSON(REQUESTS_KEY, merged)
    } catch {
      // optional
    }
  }
}

async function readPending(): Promise<ProfileChangeRequest[]> {
  const doc = await readDirectory()
  return doc.requests
}

async function writePending(requests: ProfileChangeRequest[], deletedIds: string[] = []): Promise<void> {
  const current = await readDirectory()
  await writeDirectory({
    requests,
    deletedIds: [...new Set([...current.deletedIds, ...deletedIds])],
    updatedAt: new Date().toISOString(),
  })
}

function normalizeLoginId(loginId: string): string {
  return loginId.trim().toLowerCase()
}

async function validateChanges(
  user: StoredUser,
  changes: ProfileChanges
): Promise<ProfileChanges> {
  const next: ProfileChanges = {}

  if (changes.loginId !== undefined) {
    const trimmed = changes.loginId.trim()
    const loginIdError = validateLoginId(trimmed)
    if (loginIdError) throw new Error(loginIdError)
    if (normalizeLoginId(trimmed) !== normalizeLoginId(user.loginId)) {
      if (isWaldoAccount(user.loginId)) {
        throw new Error("Waldo 소유자 계정의 아이디는 바꿀 수 없습니다.")
      }
      const existing = await findUserByLoginId(trimmed)
      if (existing && existing.id !== user.id) {
        throw new Error("이미 사용 중인 아이디입니다.")
      }
      next.loginId = trimmed
    }
  }

  if (changes.classN !== undefined) {
    const classError = classNValidationError(changes.classN)
    if (classError) throw new Error(classError)
    if (changes.classN !== user.classN) {
      next.classN = changes.classN
    }
  }

  if (changes.englishLevel !== undefined) {
    const englishError = userSchoolLevelValidationError(changes.englishLevel, "영어")
    if (englishError) throw new Error(englishError)
    if (changes.englishLevel !== user.englishLevel) {
      next.englishLevel = changes.englishLevel
    }
  }

  if (changes.mathLevel !== undefined) {
    const mathError = userSchoolLevelValidationError(changes.mathLevel, "수학")
    if (mathError) throw new Error(mathError)
    if (changes.mathLevel !== user.mathLevel) {
      next.mathLevel = changes.mathLevel
    }
  }

  if (
    !next.loginId &&
    next.classN === undefined &&
    next.englishLevel === undefined &&
    next.mathLevel === undefined
  ) {
    throw new Error("변경할 내용이 없습니다.")
  }

  return next
}

export async function getProfileChangeRequestForUser(
  userId: string
): Promise<ProfileChangeRequest | null> {
  const pending = await readPending()
  return pending.find((item) => item.userId === userId) ?? null
}

export async function listPendingProfileChangeRequests(): Promise<
  ProfileChangeRequest[]
> {
  const pending = await readPending()
  return pending.sort((a, b) => a.requestedAt.localeCompare(b.requestedAt))
}

export async function createProfileChangeRequest(
  userId: string,
  changes: ProfileChanges
): Promise<ProfileChangeRequest> {
  const user = await findUserById(userId)
  if (!user) {
    throw new Error("사용자를 찾을 수 없습니다.")
  }
  if (user.status !== "approved") {
    throw new Error("승인된 회원만 프로필 변경을 요청할 수 있습니다.")
  }

  const next = await validateChanges(user, changes)
  const pending = await readPending()
  if (pending.some((item) => item.userId === userId)) {
    throw new Error("승인 대기 중인 변경 요청이 있습니다.")
  }

  const request: ProfileChangeRequest = {
    id: createId("prq"),
    userId,
    userName: user.name,
    currentLoginId: user.loginId,
    requestedLoginId: next.loginId,
    currentClassN: user.classN,
    requestedClassN: next.classN,
    currentEnglishLevel: user.englishLevel,
    requestedEnglishLevel: next.englishLevel,
    currentMathLevel: user.mathLevel,
    requestedMathLevel: next.mathLevel,
    requestedAt: new Date().toISOString(),
  }

  pending.push(request)
  await writePending(pending)
  return request
}

export async function approveProfileChangeRequest(
  requestId: string,
  approver: StoredUser
) {
  if (!canApproveMembers(toPublicUser(approver))) {
    throw new Error("관리자만 프로필 변경을 승인할 수 있습니다.")
  }

  const pending = await readPending()
  const index = pending.findIndex((item) => item.id === requestId)
  if (index === -1) {
    throw new Error("변경 요청을 찾을 수 없습니다.")
  }

  const request = pending[index]
  const user = await applyProfileChanges(request.userId, {
    loginId: request.requestedLoginId,
    classN: request.requestedClassN,
    englishLevel: request.requestedEnglishLevel,
    mathLevel: request.requestedMathLevel,
  })

  pending.splice(index, 1)
  await writePending(pending, [request.id])
  return user
}

export async function rejectProfileChangeRequest(
  requestId: string,
  approver: StoredUser
) {
  if (!canApproveMembers(toPublicUser(approver))) {
    throw new Error("관리자만 프로필 변경을 거절할 수 있습니다.")
  }

  const pending = await readPending()
  const index = pending.findIndex((item) => item.id === requestId)
  if (index === -1) {
    throw new Error("변경 요청을 찾을 수 없습니다.")
  }

  const request = pending[index]
  pending.splice(index, 1)
  await writePending(pending, [request.id])
}
