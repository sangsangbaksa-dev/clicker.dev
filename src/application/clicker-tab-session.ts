import { clickerTabLock } from "./clicker-client-bind.ts"

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
