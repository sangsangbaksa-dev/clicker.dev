import { clickerConfig } from "@/data/clicker/catalog"
import { fail, ok, type UseCaseResult } from "@/application/result"
import {
  CLOUD_SAVE_MAX_BYTES,
  nicknameError,
  normalizeNickname,
  passwordError,
} from "@/domain/services/clicker-account"
import { decodeClickerSave } from "@/domain/services/clicker-save-codec"
import { hashPassword, verifyPassword } from "@/infrastructure/auth/password"
import type { ClickerSession } from "@/infrastructure/auth/clicker-session"
import {
  findClickerAccount,
  readClickerCloudSave,
  writeClickerAccount,
  writeClickerCloudSave,
  type ClickerCloudSave,
} from "@/infrastructure/persistence/clicker-accounts"
import { createId } from "@/shared/ids"

type Credentials = { nickname: string; password: string }

export async function signupClickerAccount({ nickname, password }: Credentials): Promise<UseCaseResult<ClickerSession>> {
  const invalid = nicknameError(nickname) ?? passwordError(password)
  if (invalid) return fail(400, invalid)
  const display = nickname.normalize("NFKC").trim()
  if (await findClickerAccount(display)) return fail(409, "이미 쓰고 있는 닉네임입니다.")
  const account = {
    id: createId("cka"),
    nickname: display,
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString(),
  }
  await writeClickerAccount(account)
  return ok({ id: account.id, nickname: account.nickname })
}

/** Per-instance brake on password guessing; bcrypt already makes each try slow. */
const FAIL_LIMIT = 8
const FAIL_WINDOW_MS = 10 * 60 * 1000
const failures = new Map<string, { count: number; until: number }>()

export async function loginClickerAccount(
  { nickname, password }: Credentials,
  now = Date.now(),
): Promise<UseCaseResult<ClickerSession>> {
  const key = normalizeNickname(nickname)
  const record = failures.get(key)
  if (record && record.until > now && record.count >= FAIL_LIMIT) {
    return fail(429, "로그인 시도가 너무 많습니다. 10분 뒤에 다시 시도해 주세요.")
  }
  const account = key ? await findClickerAccount(nickname) : null
  if (!account || !(await verifyPassword(password, account.passwordHash))) {
    const next = record && record.until > now ? record.count + 1 : 1
    failures.set(key, { count: next, until: now + FAIL_WINDOW_MS })
    return fail(401, "닉네임 또는 비밀번호가 맞지 않습니다.")
  }
  failures.delete(key)
  return ok({ id: account.id, nickname: account.nickname })
}

export async function getClickerCloudSave(session: ClickerSession): Promise<UseCaseResult<ClickerCloudSave | null>> {
  return ok(await readClickerCloudSave(session.id))
}

/**
 * Store the player's save. Refuses anything the game itself couldn't load. Optimistic
 * concurrency: `baseSavedAt` is the cloud version this device last synced with; if the
 * cloud moved on since (another device wrote), the upload is refused unless `force`.
 */
export async function putClickerCloudSave(
  session: ClickerSession,
  body: { raw?: unknown; force?: unknown; baseSavedAt?: unknown },
  now = Date.now(),
): Promise<UseCaseResult<{ savedAt: number }>> {
  if (typeof body.raw !== "string" || !body.raw) return fail(400, "저장 데이터가 없습니다.")
  if (new TextEncoder().encode(body.raw).length > CLOUD_SAVE_MAX_BYTES) return fail(413, "저장 데이터가 너무 큽니다.")
  const decoded = decodeClickerSave(body.raw, clickerConfig, now)
  if (decoded.status === "corrupt" || decoded.status === "empty" || decoded.status === "future") {
    return fail(400, "읽을 수 없는 저장 데이터입니다.")
  }
  const savedAt = decoded.save.savedAt
  if (!Number.isFinite(savedAt) || savedAt > now + 5 * 60 * 1000) return fail(400, "저장 시각이 올바르지 않습니다.")
  if (body.force !== true) {
    const stored = await readClickerCloudSave(session.id)
    const base = typeof body.baseSavedAt === "number" ? body.baseSavedAt : 0
    if (stored && stored.savedAt !== base) {
      return fail(409, "다른 기기에 더 최근 진행이 저장되어 있습니다.", {
        conflict: true,
        payload: { serverSavedAt: stored.savedAt },
      })
    }
  }
  await writeClickerCloudSave(session.id, { raw: body.raw, savedAt, updatedAt: new Date(now).toISOString() })
  return ok({ savedAt })
}
