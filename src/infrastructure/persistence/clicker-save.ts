const KEY = "aurelia-clicker-save-v1"
/** Raw saves that failed to load cleanly, newest first; never touched by autosave. */
export const BACKUP_KEY = `${KEY}:backups`
export const MAX_CLICKER_BACKUPS = 3

export type ClickerSaveBackup = { at: number; reason: string; raw: string }

function storage(): Storage | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function readClickerRaw(): string | null {
  try {
    return storage()?.getItem(KEY) ?? null
  } catch {
    return null
  }
}

export function writeClickerRaw(value: string): void {
  try {
    storage()?.setItem(KEY, value)
  } catch {
    // quota / private mode — keep playing in memory
  }
}

export function clearClickerRaw(): void {
  try {
    storage()?.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

export function readClickerBackups(): ClickerSaveBackup[] {
  try {
    const parsed: unknown = JSON.parse(storage()?.getItem(BACKUP_KEY) ?? "[]")
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (b): b is ClickerSaveBackup =>
        !!b && typeof b === "object" && typeof b.raw === "string" && typeof b.at === "number" && typeof b.reason === "string",
    )
  } catch {
    return []
  }
}

/**
 * Keep a copy of a raw save before it gets replaced. Returns false when storage refused
 * it (callers can then avoid overwriting the original).
 */
export function backupClickerRaw(raw: string, reason: string, at: number): boolean {
  const store = storage()
  if (!store) return false
  const existing = readClickerBackups()
  if (existing.some((b) => b.raw === raw)) return true
  const entry: ClickerSaveBackup = { at, reason, raw }
  // On quota errors, drop the oldest backups until the new one fits.
  for (let keep = MAX_CLICKER_BACKUPS - 1; keep >= 0; keep--) {
    try {
      store.setItem(BACKUP_KEY, JSON.stringify([entry, ...existing.slice(0, keep)]))
      return true
    } catch {
      /* try with fewer */
    }
  }
  return false
}
