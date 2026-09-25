import { getCache } from "@vercel/functions"

const TTL_SECONDS = 60 * 60 * 24 * 30

if (!process.env.RUNTIME_CACHE_TIMEOUT) {
  process.env.RUNTIME_CACHE_TIMEOUT = "1500"
}

export type RuntimeRead<T> =
  | { status: "hit"; value: T }
  | { status: "miss"; value: null }
  | { status: "error"; value: null }
  | { status: "skip"; value: null }

function runtimeCache() {
  if (!process.env.VERCEL) return null
  try {
    return getCache({ namespace: "hsms-md" })
  } catch {
    return null
  }
}

export async function runtimeGetWithStatus<T>(key: string): Promise<RuntimeRead<T>> {
  const cache = runtimeCache()
  if (!cache) return { status: "skip", value: null }
  try {
    const value = await cache.get(key)
    if (value == null) return { status: "miss", value: null }
    return { status: "hit", value: value as T }
  } catch {
    return { status: "error", value: null }
  }
}

export async function runtimeGet<T>(key: string): Promise<T | null> {
  const result = await runtimeGetWithStatus<T>(key)
  return result.status === "hit" ? result.value : null
}

export async function runtimeSet(key: string, value: unknown): Promise<void> {
  const cache = runtimeCache()
  if (!cache) return
  try {
    await cache.set(key, value, { ttl: TTL_SECONDS, tags: ["hsms-data"], name: key })
  } catch {
    // optional shared cache
  }
}

export async function runtimeDelete(key: string): Promise<void> {
  const cache = runtimeCache()
  if (!cache) return
  try {
    await cache.delete(key)
  } catch {
    // optional
  }
}
