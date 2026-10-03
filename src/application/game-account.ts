import "server-only"

import {
  cloudSaveError,
  normalizeLoginId,
  saveProgress,
  shouldReplaceCloudSave,
  signupError,
  toPublicAccount,
  type ClickerAccountPublic,
  type ClickerSignupInput,
  type CloudSaveMeta,
} from "@/domain/services/clicker-account"
import { hashPassword, verifyPassword } from "@/infrastructure/auth/password"
import {
  createClickerAccount,
  findClickerAccount,
  readCloudSave,
  writeCloudSave,
} from "@/infrastructure/persistence/clicker-accounts"
import { createId } from "@/shared/ids"

type Result<T> = { ok: true; value: T } | { ok: false; error: string; status: number }

export async function signupClicker(input: ClickerSignupInput): Promise<Result<ClickerAccountPublic>> {
  const problem = signupError(input)
  if (problem) return { ok: false, error: problem, status: 400 }
  const account = {
    id: createId("cp"),
    loginId: normalizeLoginId(input.loginId),
    nickname: (input.nickname ?? "").trim(),
    passwordHash: await hashPassword(input.password ?? ""),
    createdAt: Date.now(),
  }
  if (!(await createClickerAccount(account))) return { ok: false, error: "이미 사용 중인 아이디입니다.", status: 409 }
  return { ok: true, value: toPublicAccount(account) }
}

export async function loginClicker(loginId: string | undefined, password: string | undefined): Promise<Result<ClickerAccountPublic>> {
  const account = await findClickerAccount(normalizeLoginId(loginId))
  if (!account || !(await verifyPassword(password ?? "", account.passwordHash))) {
    return { ok: false, error: "아이디 또는 비밀번호가 맞지 않습니다.", status: 401 }
  }
  return { ok: true, value: toPublicAccount(account) }
}

export async function loadCloudSave(accountId: string): Promise<{ json: string; meta: CloudSaveMeta } | null> {
  const save = await readCloudSave(accountId)
  return save ? { json: save.json, meta: { savedAt: save.savedAt, size: save.json.length, totalCore: saveProgress(save.json) } } : null
}

/** Stores the upload unless the cloud already holds a run with more total CORE (then keeps that one). */
export async function storeCloudSave(accountId: string, json: unknown): Promise<Result<CloudSaveMeta>> {
  const problem = cloudSaveError(json)
  if (problem) return { ok: false, error: problem, status: 400 }
  const current = await readCloudSave(accountId)
  if (current && !shouldReplaceCloudSave(current.json, json as string)) {
    return { ok: true, value: { savedAt: current.savedAt, size: current.json.length, totalCore: saveProgress(current.json), kept: true } }
  }
  const meta = await writeCloudSave(accountId, json as string, Date.now())
  return { ok: true, value: { ...meta, totalCore: saveProgress(json as string) } }
}
