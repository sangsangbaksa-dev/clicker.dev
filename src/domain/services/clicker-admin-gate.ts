/**
 * Pre-launch playtest: the live site also offers the admin panel to anyone who opens it with
 * `?admin=1` (remembered in this browser). Set to `false` at launch — that removes admin
 * from every production build again.
 *
 * Playtest on production without flipping this flag: set `NEXT_PUBLIC_CLICKER_ADMIN=1` at build time.
 */
export const CLICKER_PRELAUNCH = false

/** localStorage key that remembers a pre-launch `?admin=1` visit. */
export const CLICKER_ADMIN_REMEMBER_KEY = "clicker-admin"

function rememberedAdmin(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(CLICKER_ADMIN_REMEMBER_KEY) === "1"
  } catch {
    return false
  }
}

export type ClickerAdminGateInput = {
  nodeEnv?: string
  hostname?: string
  search?: string
  /** Defaults to `CLICKER_PRELAUNCH`. */
  prelaunch?: boolean
  /** This browser opened `?admin=1` before (pre-launch only). Defaults to reading localStorage. */
  remembered?: boolean
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
 * Production: only before launch (`CLICKER_PRELAUNCH`), via `?admin=1` or a remembered visit.
 */
export function isClickerAdminAllowed(input: ClickerAdminGateInput = {}): boolean {
  const nodeEnv = (
    input.nodeEnv ??
    (typeof process !== "undefined" && process.env.NODE_ENV ? process.env.NODE_ENV : "production")
  ).toLowerCase()
  // Playtest builds opt in explicitly; otherwise production never exposes admin helpers.
  if (process.env.NEXT_PUBLIC_CLICKER_ADMIN === "1" && input.nodeEnv === undefined) return true

  if (!input.hostname && typeof window === "undefined") return false

  const hostname =
    input.hostname ?? (typeof window !== "undefined" ? window.location.hostname : "")
  const search = input.search ?? (typeof window !== "undefined" ? window.location.search : "")
  const adminQuery = new URLSearchParams(search).get("admin") === "1"

  if (nodeEnv === "production") {
    const prelaunch = input.prelaunch ?? CLICKER_PRELAUNCH
    return prelaunch && (adminQuery || (input.remembered ?? rememberedAdmin()))
  }

  return isClickerAdminHost(hostname) || adminQuery
}
