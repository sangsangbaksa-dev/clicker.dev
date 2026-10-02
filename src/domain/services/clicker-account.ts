export const LOGIN_ID_PATTERN = /^[a-z0-9_]{3,20}$/
export const PASSWORD_MIN = 6
export const PASSWORD_MAX = 64
export const NICKNAME_MAX = 12

export type ClickerAccountInput = { loginId: string; nickname: string; password: string; passwordConfirm?: string }

export function normalizeLoginId(raw: string): string {
  return raw.trim().toLowerCase()
}

/** Returns a Korean error message, or null when the signup input is valid. */
export function validateSignup(input: ClickerAccountInput): string | null {
  const loginId = normalizeLoginId(input.loginId)
  if (!LOGIN_ID_PATTERN.test(loginId)) return "아이디는 영문 소문자·숫자·밑줄 3~20자로 입력해 주세요."
  const nick = input.nickname.trim()
  if (nick.length < 1 || nick.length > NICKNAME_MAX) return `닉네임은 1~${NICKNAME_MAX}자로 입력해 주세요.`
  if (input.password.length < PASSWORD_MIN) return `비밀번호는 ${PASSWORD_MIN}자 이상이어야 해요.`
  if (input.password.length > PASSWORD_MAX) return `비밀번호는 ${PASSWORD_MAX}자 이하여야 해요.`
  if (input.passwordConfirm !== undefined && input.passwordConfirm !== input.password) return "비밀번호가 일치하지 않아요."
  return null
}
