/** Game accounts: a login id, a display nickname and a password; cloud saves hang off the id. */

export type ClickerAccount = {
  id: string
  loginId: string
  nickname: string
  passwordHash: string
  createdAt: number
}

export type ClickerAccountPublic = { id: string; loginId: string; nickname: string }

export type ClickerSignupInput = {
  loginId?: string
  nickname?: string
  password?: string
  passwordConfirm?: string
}

export type CloudSaveMeta = { savedAt: number; size: number }

export const LOGIN_ID_PATTERN = /^[a-z0-9_]{3,20}$/
export const NICKNAME_MAX = 12
export const PASSWORD_MIN = 6
export const PASSWORD_MAX = 72
/** A full late-game save is ~20 KB; anything far past this is not a save. */
export const CLOUD_SAVE_MAX_BYTES = 512 * 1024

export function normalizeLoginId(raw: string | undefined): string {
  return (raw ?? "").trim().toLowerCase()
}

/** The first problem with a signup form, or null when it can be created. */
export function signupError(input: ClickerSignupInput): string | null {
  const loginId = normalizeLoginId(input.loginId)
  const nickname = (input.nickname ?? "").trim()
  const password = input.password ?? ""
  if (!LOGIN_ID_PATTERN.test(loginId)) return "아이디는 영문 소문자·숫자·밑줄 3~20자로 정해 주세요."
  if (!nickname) return "닉네임을 입력해 주세요."
  if ([...nickname].length > NICKNAME_MAX) return `닉네임은 ${NICKNAME_MAX}자까지입니다.`
  if (password.length < PASSWORD_MIN) return `비밀번호는 ${PASSWORD_MIN}자 이상이어야 합니다.`
  if (password.length > PASSWORD_MAX) return `비밀번호는 ${PASSWORD_MAX}자까지입니다.`
  if (password !== (input.passwordConfirm ?? "")) return "비밀번호 확인이 일치하지 않습니다."
  return null
}

export function toPublicAccount(account: ClickerAccount): ClickerAccountPublic {
  return { id: account.id, loginId: account.loginId, nickname: account.nickname }
}

/** Cloud saves must be a JSON object of sane size (the client decodes and validates it on load). */
export function cloudSaveError(json: unknown): string | null {
  if (typeof json !== "string" || !json) return "저장 데이터가 비어 있습니다."
  if (json.length > CLOUD_SAVE_MAX_BYTES) return "저장 데이터가 너무 큽니다."
  try {
    const parsed: unknown = JSON.parse(json)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "저장 데이터 형식이 올바르지 않습니다."
  } catch {
    return "저장 데이터 형식이 올바르지 않습니다."
  }
  return null
}
