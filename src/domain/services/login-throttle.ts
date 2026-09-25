/** 로그인 실패 횟수 제한 (아이디 + 접속 IP 단위). 프레임워크와 저장소에 무관한 순수 규칙. */

export const LOGIN_FAILURE_LIMIT = 5
export const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000
export const LOGIN_BASE_LOCK_MS = 60 * 1000
export const LOGIN_MAX_LOCK_MS = 15 * 60 * 1000

export type LoginThrottleState = {
  /** 현재 창에서 연속 실패 횟수 */
  failures: number
  /** 첫 실패 시각 (ms) */
  windowStart: number
  /** 이 시각 전에는 로그인 시도를 막는다 (ms) */
  lockedUntil: number
  /** 지금까지 잠긴 횟수. 잠길 때마다 잠금 시간이 두 배가 된다. */
  lockCount: number
}

export function emptyLoginThrottle(now: number): LoginThrottleState {
  return { failures: 0, windowStart: now, lockedUntil: 0, lockCount: 0 }
}

/** 잠겨 있으면 남은 시간(ms), 아니면 0 */
export function loginRetryAfterMs(state: LoginThrottleState | null, now: number): number {
  if (!state) return 0
  return Math.max(0, state.lockedUntil - now)
}

export function recordLoginFailure(
  state: LoginThrottleState | null,
  now: number
): LoginThrottleState {
  let next = state ? { ...state } : emptyLoginThrottle(now)
  if (now - next.windowStart > LOGIN_FAILURE_WINDOW_MS) {
    next = { ...emptyLoginThrottle(now), lockCount: next.lockCount }
  }
  next.failures += 1
  if (next.failures >= LOGIN_FAILURE_LIMIT) {
    const lockMs = Math.min(LOGIN_BASE_LOCK_MS * 2 ** next.lockCount, LOGIN_MAX_LOCK_MS)
    next.lockedUntil = now + lockMs
    next.lockCount += 1
    next.failures = 0
    next.windowStart = now
  }
  return next
}

export function loginThrottleKey(loginId: string, clientIp: string): string {
  return `login-throttle:${loginId.trim().toLowerCase()}:${clientIp || "unknown"}`
}

export function loginLockedMessage(retryAfterMs: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterMs / 60_000))
  return `로그인 시도가 너무 많습니다. ${minutes}분 뒤에 다시 시도해 주세요.`
}
