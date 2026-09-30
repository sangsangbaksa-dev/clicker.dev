const STORAGE_KEY = "aurelia-clicker-ui-lang"

export function readStoredUiLang(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function writeStoredUiLang(tag: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, tag)
  } catch {
    /* quota / private mode */
  }
}

export function readNavigatorUiLang(): string | null {
  if (typeof navigator === "undefined") return null
  return navigator.language || null
}
