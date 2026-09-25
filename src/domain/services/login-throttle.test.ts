import assert from "node:assert/strict"
import test from "node:test"
import {
  LOGIN_BASE_LOCK_MS,
  LOGIN_FAILURE_LIMIT,
  LOGIN_FAILURE_WINDOW_MS,
  LOGIN_MAX_LOCK_MS,
  loginRetryAfterMs,
  loginThrottleKey,
  recordLoginFailure,
  type LoginThrottleState,
} from "./login-throttle.ts"

function failTimes(count: number, now: number, start: LoginThrottleState | null = null) {
  let state = start
  for (let i = 0; i < count; i += 1) state = recordLoginFailure(state, now)
  return state!
}

test("allows attempts below the limit", () => {
  const state = failTimes(LOGIN_FAILURE_LIMIT - 1, 1_000)
  assert.equal(loginRetryAfterMs(state, 1_000), 0)
})

test("locks after the limit and unlocks when the lock expires", () => {
  const state = failTimes(LOGIN_FAILURE_LIMIT, 1_000)
  assert.equal(loginRetryAfterMs(state, 1_000), LOGIN_BASE_LOCK_MS)
  assert.equal(loginRetryAfterMs(state, 1_000 + LOGIN_BASE_LOCK_MS), 0)
})

test("repeat lockouts double up to the maximum", () => {
  let state: LoginThrottleState | null = null
  let now = 0
  const locks: number[] = []
  for (let round = 0; round < 8; round += 1) {
    state = failTimes(LOGIN_FAILURE_LIMIT, now, state)
    locks.push(loginRetryAfterMs(state, now))
    now = state.lockedUntil
  }
  assert.equal(locks[0], LOGIN_BASE_LOCK_MS)
  assert.equal(locks[1], LOGIN_BASE_LOCK_MS * 2)
  assert.equal(locks.at(-1), LOGIN_MAX_LOCK_MS)
})

test("failures spread beyond the window do not lock", () => {
  let state: LoginThrottleState | null = null
  let now = 0
  for (let i = 0; i < LOGIN_FAILURE_LIMIT * 2; i += 1) {
    state = recordLoginFailure(state, now)
    assert.equal(loginRetryAfterMs(state, now), 0)
    now += LOGIN_FAILURE_WINDOW_MS / (LOGIN_FAILURE_LIMIT - 1) + 1
  }
})

test("key is per login id (case-insensitive) and per IP", () => {
  assert.equal(loginThrottleKey(" Waldo ", "1.2.3.4"), loginThrottleKey("waldo", "1.2.3.4"))
  assert.notEqual(loginThrottleKey("waldo", "1.2.3.4"), loginThrottleKey("waldo", "5.6.7.8"))
})
