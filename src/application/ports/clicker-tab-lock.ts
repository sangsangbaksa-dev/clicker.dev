export type ClickerLeaseStorage = Pick<Storage, "getItem" | "setItem">

/** Single-writer lease across browser tabs for the shared clicker save key. */
export type ClickerTabLockPort = {
  createTabId(): string
  leaseStorage(): ClickerLeaseStorage | null
  claimLease(tabId: string, now: number): void
  canWriteSave(tabId: string, now: number): boolean
  isLeaseTakenByOther(key: string | null, newValue: string | null, tabId: string): boolean
}
