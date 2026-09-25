const KEY = "aurelia-clicker-save-v1"

export function readClickerRaw(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function writeClickerRaw(value: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(KEY, value)
  } catch {
    // quota / private mode — keep playing in memory
  }
}

export function clearClickerRaw(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
