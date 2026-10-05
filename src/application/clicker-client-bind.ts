import type { ClickerPersistencePort } from "./ports/clicker-persistence.ts"
import type { ClickerTabLockPort } from "./ports/clicker-tab-lock.ts"
import type { ClickerCompletionRecordsPort } from "./ports/clicker-completion-records.ts"

let persistence: ClickerPersistencePort | null = null
let tabLock: ClickerTabLockPort | null = null
let completionRecords: ClickerCompletionRecordsPort | null = null

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

export const clickerCompletionRecordsFallback: ClickerCompletionRecordsPort = {
  read: () => ({ available: false, records: [] }),
  save: () => false,
}

export function bindClickerPersistence(port: ClickerPersistencePort): void {
  persistence = port
}

export function bindClickerCompletionRecords(port: ClickerCompletionRecordsPort): void {
  completionRecords = port
}

export function bindClickerTabLock(port: ClickerTabLockPort): void {
  tabLock = port
}

export function clickerPersistence(): ClickerPersistencePort {
  return persistence ?? clickerPersistenceFallback
}

export function clickerTabLock(): ClickerTabLockPort {
  return tabLock ?? clickerTabLockFallback
}

export function clickerCompletionRecords(): ClickerCompletionRecordsPort {
  return completionRecords ?? clickerCompletionRecordsFallback
}

export function clickerCreateTabId(): string {
  return clickerTabLock().createTabId()
}

export function clickerClaimLease(tabId: string, now: number): void {
  clickerTabLock().claimLease(tabId, now)
}

export function clickerCanWriteSave(tabId: string, now: number): boolean {
  return clickerTabLock().canWriteSave(tabId, now)
}

export function clickerIsLeaseTakenByOther(key: string | null, newValue: string | null, tabId: string): boolean {
  return clickerTabLock().isLeaseTakenByOther(key, newValue, tabId)
}

/** Test-only: clear bindings so each test can install fakes. */
export function resetClickerClientBindings(): void {
  persistence = null
  tabLock = null
  completionRecords = null
  resetClickerClientFallbackState()
}
