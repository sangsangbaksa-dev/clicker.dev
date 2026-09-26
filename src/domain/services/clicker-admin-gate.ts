export type ClickerAdminGateInput = {
  nodeEnv?: string
  hostname?: string
  search?: string
  /** The player turned admin mode on from Settings (stored per browser). */
  enabled?: boolean
}

/** localStorage key for the Settings → 관리자 모드 switch. */
export const CLICKER_ADMIN_STORAGE_KEY = "aurelia-clicker-admin"

export function isClickerAdminHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  )
}

function readAdminEnabled(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(CLICKER_ADMIN_STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

/** Remembers the Settings switch in this browser; the game save is local, so cheats only touch it. */
export function setClickerAdminEnabled(enabled: boolean): void {
  try {
    if (enabled) window.localStorage.setItem(CLICKER_ADMIN_STORAGE_KEY, "1")
    else window.localStorage.removeItem(CLICKER_ADMIN_STORAGE_KEY)
  } catch {
    // Storage blocked (private mode): the switch just won't survive a reload.
  }
}

/**
 * Admin panel/cheats. On when the player switched it on in Settings, or with `?admin=1`;
 * development builds also open it on loopback hosts.
 */
export function isClickerAdminAllowed(input: ClickerAdminGateInput = {}): boolean {
  if (input.enabled ?? readAdminEnabled()) return true

  const search = input.search ?? (typeof window !== "undefined" ? window.location.search : "")
  if (new URLSearchParams(search).get("admin") === "1") return true

  const nodeEnv = (
    input.nodeEnv ??
    (typeof process !== "undefined" && process.env.NODE_ENV ? process.env.NODE_ENV : "production")
  ).toLowerCase()
  if (nodeEnv === "production") return false

  const hostname =
    input.hostname ?? (typeof window !== "undefined" ? window.location.hostname : "")
  return isClickerAdminHost(hostname)
}
