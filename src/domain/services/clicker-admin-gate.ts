export type ClickerAdminGateInput = {
  nodeEnv?: string
  hostname?: string
  search?: string
}

export function isClickerAdminHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  )
}

/**
 * Playtest admin panel/cheats — never in production builds.
 * Non-prod only: loopback host, or explicit `?admin=1` for LAN/preview playtest.
 * UI also strips via `process.env.NODE_ENV !== "production"` for dead-code elimination.
 */
export function isClickerAdminAllowed(input: ClickerAdminGateInput = {}): boolean {
  const nodeEnv = (
    input.nodeEnv ??
    (typeof process !== "undefined" && process.env.NODE_ENV ? process.env.NODE_ENV : "production")
  ).toLowerCase()
  // Playtest builds opt in explicitly; otherwise production never exposes admin helpers.
  if (process.env.NEXT_PUBLIC_CLICKER_ADMIN === "1" && input.nodeEnv === undefined) return true
  if (nodeEnv === "production") return false

  if (!input.hostname && typeof window === "undefined") return false

  const hostname =
    input.hostname ?? (typeof window !== "undefined" ? window.location.hostname : "")
  const search = input.search ?? (typeof window !== "undefined" ? window.location.search : "")

  const loopback = isClickerAdminHost(hostname)
  const adminQuery = new URLSearchParams(search).get("admin") === "1"

  return loopback || adminQuery
}
