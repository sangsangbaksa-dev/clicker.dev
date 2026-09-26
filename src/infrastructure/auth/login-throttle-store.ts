import type { LoginThrottleState } from "@/domain/services/login-throttle"
import { LOGIN_FAILURE_WINDOW_MS, LOGIN_MAX_LOCK_MS } from "@/domain/services/login-throttle"
import { runtimeDelete, runtimeGetWithStatus, runtimeSet } from "@/infrastructure/persistence/runtime-json-store"

/** Vercel Runtime Cache가 없을 때(로컬 등) 쓰는 인스턴스 메모리. */
const memory = new Map<string, LoginThrottleState>()
const MEMORY_LIMIT = 5_000
const STALE_MS = LOGIN_FAILURE_WINDOW_MS + LOGIN_MAX_LOCK_MS

export async function readLoginThrottle(key: string): Promise<LoginThrottleState | null> {
  const shared = await runtimeGetWithStatus<LoginThrottleState>(key)
  if (shared.status === "hit") return shared.value
  if (shared.status === "miss") return null
  return memory.get(key) ?? null
}

export async function writeLoginThrottle(key: string, state: LoginThrottleState): Promise<void> {
  if (memory.size >= MEMORY_LIMIT) {
    const cutoff = Date.now() - STALE_MS
    for (const [k, v] of memory) {
      if (v.windowStart < cutoff && v.lockedUntil < Date.now()) memory.delete(k)
    }
    if (memory.size >= MEMORY_LIMIT) memory.clear()
  }
  memory.set(key, state)
  await runtimeSet(key, state)
}

export async function clearLoginThrottle(key: string): Promise<void> {
  memory.delete(key)
  await runtimeDelete(key)
}

/** 플랫폼이 넣어 준 접속 IP (Vercel은 x-forwarded-for를 덮어써 위조를 막는다). */
export function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return forwarded || request.headers.get("x-real-ip")?.trim() || ""
}
