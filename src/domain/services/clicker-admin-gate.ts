/**
 * TEMPORARY: until the official release, the deployed (production) build also
 * ships the playtest admin panel, opened with `?admin=1`. Flip to `false`
 * before release — that alone restores the dev-only gate and build strip.
 */
export const CLICKER_ADMIN_TEMP_IN_PRODUCTION = true

export type ClickerAdminGateInput = {
  nodeEnv?: string
  hostname?: string
  search?: string
  tempInProduction?: boolean
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
 * Playtest admin panel/cheats.
 * Non-prod: loopback host, or explicit `?admin=1` for LAN/preview playtest.
 * Production: denied, unless CLICKER_ADMIN_TEMP_IN_PRODUCTION — then `?admin=1` only.
 * UI also strips via `process.env.NODE_ENV !== "production"` for dead-code elimination.
 */
export function isClickerAdminAllowed(input: ClickerAdminGateInput = {}): boolean {
  const nodeEnv = (
    input.nodeEnv ??
    (typeof process !== "undefined" && process.env.NODE_ENV ? process.env.NODE_ENV : "production")
  ).toLowerCase()
  const tempInProduction = input.tempInProduction ?? CLICKER_ADMIN_TEMP_IN_PRODUCTION
  // Hard deny: production (and Production casing) never exposes admin helpers,
  // except during the temporary pre-release window below.
  if (nodeEnv === "production" && !tempInProduction) return false

  if (!input.hostname && typeof window === "undefined") return false

  const hostname =
    input.hostname ?? (typeof window !== "undefined" ? window.location.hostname : "")
  const search = input.search ?? (typeof window !== "undefined" ? window.location.search : "")

  const loopback = isClickerAdminHost(hostname)
  const adminQuery = new URLSearchParams(search).get("admin") === "1"

  if (nodeEnv === "production") return adminQuery
  return loopback || adminQuery
}
