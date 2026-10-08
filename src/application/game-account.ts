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
import {
  leaderboardEntryFromSave,
  leaderboardView,
  publicLeaderboardRow,
  upsertLeaderboard,
  type LeaderboardKind,
  type PublicLeaderboardRow,
} from "@/domain/services/clicker-leaderboard"
import { hashPassword, verifyPassword } from "@/infrastructure/auth/password"
import {
  createClickerAccount,
  findClickerAccount,
  readCloudSave,
  readLeaderboard,
  writeCloudSave,
  writeLeaderboard,
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
export async function storeCloudSave(account: ClickerAccountPublic, json: unknown): Promise<Result<CloudSaveMeta>> {
  const problem = cloudSaveError(json)
  if (problem) return { ok: false, error: problem, status: 400 }
  const current = await readCloudSave(account.id)
  if (current && !shouldReplaceCloudSave(current.json, json as string)) {
    return { ok: true, value: { savedAt: current.savedAt, size: current.json.length, totalCore: saveProgress(current.json), kept: true } }
  }
  const meta = await writeCloudSave(account.id, json as string, Date.now())
  await recordLeaderboard(account, json as string)
  return { ok: true, value: { ...meta, totalCore: saveProgress(json as string) } }
}

/** Refresh the player's ranking row from the save just stored. Best effort: never fails the upload. */
async function recordLeaderboard(account: ClickerAccountPublic, json: string): Promise<void> {
  try {
    const entry = leaderboardEntryFromSave(json, account, Date.now())
    if (!entry) return
    await writeLeaderboard(upsertLeaderboard(await readLeaderboard(), entry))
  } catch {
    // The ranking is a side table; a failed write only delays this player's row.
  }
}

export type LeaderboardResponse = {
  kind: LeaderboardKind
  top: PublicLeaderboardRow[]
  me: PublicLeaderboardRow | null
  total: number
}

export async function loadLeaderboard(kind: LeaderboardKind, accountId: string | null): Promise<LeaderboardResponse> {
  const view = leaderboardView(await readLeaderboard(), kind, accountId)
  return {
    kind,
    top: view.top.map((e) => publicLeaderboardRow(e, accountId)),
    me: view.me ? publicLeaderboardRow(view.me, accountId) : null,
    total: view.total,
  }
}
