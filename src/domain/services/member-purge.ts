/** Exact loginId "waldo" only. Waldo2 is not protected. */
function isExactWaldoLoginId(loginId: string): boolean {
  return loginId.trim().toLowerCase() === "waldo"
}

/** 승인·대기 모두 포함. 아이디가 정확히 waldo 인 소유자만 남긴다. */
export function shouldPurgeStoredUser(user: { loginId: string }): boolean {
  return !isExactWaldoLoginId(user.loginId)
}

export function selectUsersToPurge<T extends { loginId: string }>(users: T[]): T[] {
  return users.filter(shouldPurgeStoredUser)
}
