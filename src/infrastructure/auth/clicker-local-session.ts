import type { ClickerPublicAccount } from "@/application/clicker-account"

export const CLICKER_LOCAL_SESSION_KEY = "aurelia-clicker-local-session-v1"

export function readClickerLocalSession(): ClickerPublicAccount | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(CLICKER_LOCAL_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ClickerPublicAccount>
    if (typeof parsed.id !== "string" || typeof parsed.loginId !== "string" || typeof parsed.nickname !== "string") {
      return null
    }
    return { id: parsed.id, loginId: parsed.loginId, nickname: parsed.nickname }
  } catch {
    return null
  }
}

export function writeClickerLocalSession(account: ClickerPublicAccount | null): void {
  if (typeof window === "undefined") return
  try {
    if (!account) window.localStorage.removeItem(CLICKER_LOCAL_SESSION_KEY)
    else window.localStorage.setItem(CLICKER_LOCAL_SESSION_KEY, JSON.stringify(account))
  } catch {
    /* quota / private mode */
  }
}
