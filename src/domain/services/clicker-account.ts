/** Game-only accounts: a nickname + password, no approval step. Pure rules, no I/O. */

export const NICKNAME_MIN = 2
export const NICKNAME_MAX = 16
export const PASSWORD_MIN = 6
export const PASSWORD_MAX = 72 // bcrypt ignores bytes past 72
/** Uploaded saves above this are refused (a real save is a few KB). */
export const CLOUD_SAVE_MAX_BYTES = 256 * 1024

const NICKNAME_CHARS = /^[\p{L}\p{N}_-]+$/u

/** Lookup key: case- and width-insensitive, so "Luma" and "luma" are the same account. */
export function normalizeNickname(nickname: string): string {
  return nickname.normalize("NFKC").trim().toLowerCase()
}

export function nicknameError(nickname: string): string | undefined {
  const value = nickname.normalize("NFKC").trim()
  const length = [...value].length
  if (length < NICKNAME_MIN || length > NICKNAME_MAX) {
    return `닉네임은 ${NICKNAME_MIN}~${NICKNAME_MAX}자로 입력해 주세요.`
  }
  if (!NICKNAME_CHARS.test(value)) return "닉네임에는 글자, 숫자, _ , - 만 쓸 수 있습니다."
  return undefined
}

export function passwordError(password: string): string | undefined {
  if (password.length < PASSWORD_MIN) return `비밀번호는 ${PASSWORD_MIN}자 이상이어야 합니다.`
  if (new TextEncoder().encode(password).length > PASSWORD_MAX) return "비밀번호가 너무 깁니다."
  return undefined
}

/** Storage-safe key segment for a normalized nickname (hex of its UTF-8 bytes). */
export function nicknameKey(nickname: string): string {
  return [...new TextEncoder().encode(normalizeNickname(nickname))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}
