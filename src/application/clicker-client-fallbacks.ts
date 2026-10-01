import type { ClickerPersistencePort } from "./ports/clicker-persistence.ts"
import type { ClickerTabLockPort } from "./ports/clicker-tab-lock.ts"

/** In-memory save when the browser adapter has not been bound yet (SSR / bundle order). */
let memorySave: string | null = null

export const clickerPersistenceFallback: ClickerPersistencePort = {
  readRaw: () => memorySave,
  writeRaw: (value) => {
    memorySave = value
  },
  backupRaw: () => true,
  clearRaw: () => {
    memorySave = null
  },
}

/** Fail-open tab lock: single-tab play works; multi-tab clobbering is possible until the real port binds. */
/** Test-only: clear fallback memory between cases. */
export function resetClickerClientFallbackState(): void {
  memorySave = null
}

export const clickerTabLockFallback: ClickerTabLockPort = {
  createTabId: () => `tab-fallback-${Date.now().toString(36)}`,
  leaseStorage: () => null,
  claimLease: () => {},
  canWriteSave: () => true,
  isLeaseTakenByOther: () => false,
}
