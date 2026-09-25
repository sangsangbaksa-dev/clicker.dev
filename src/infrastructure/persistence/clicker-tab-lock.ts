/**
 * Single-writer lease for the clicker save across browser tabs.
 *
 * Every tab plays from an in-memory copy and autosaves it to the same localStorage key,
 * so two open tabs would keep overwriting each other's progress. The most recently
 * opened (or resumed) tab claims the lease; any other tab must stop writing.
 */
export const CLICKER_LOCK_KEY = "aurelia-clicker-writer-v1"

export type LeaseStorage = Pick<Storage, "getItem" | "setItem">

type Lease = { tabId: string; claimedAt: number }

export function createClickerTabId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (c?.randomUUID) return c.randomUUID()
  return `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export function readLeaseOwner(raw: string | null): string | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<Lease> | null
    return typeof parsed?.tabId === "string" && parsed.tabId ? parsed.tabId : null
  } catch {
    return null
  }
}

/** Take the lease for this tab, evicting whichever tab held it. */
export function claimClickerLease(storage: LeaseStorage | null, tabId: string, now: number): void {
  if (!storage) return
  try {
    storage.setItem(CLICKER_LOCK_KEY, JSON.stringify({ tabId, claimedAt: now } satisfies Lease))
  } catch {
    /* quota / private mode — writes stay allowed, see canWriteClickerSave */
  }
}

/**
 * Whether this tab may write the save right now. An unowned lease is claimed on the spot.
 * Unreadable storage fails open: the save write would fail the same way, so nothing is clobbered.
 */
export function canWriteClickerSave(storage: LeaseStorage | null, tabId: string, now: number): boolean {
  if (!storage) return true
  let owner: string | null
  try {
    owner = readLeaseOwner(storage.getItem(CLICKER_LOCK_KEY))
  } catch {
    return true
  }
  if (owner === tabId) return true
  if (owner) return false
  claimClickerLease(storage, tabId, now)
  return true
}

/** A `storage` event saying another tab just took the lease away from this one. */
export function isLeaseTakenByOther(key: string | null, newValue: string | null, tabId: string): boolean {
  if (key !== CLICKER_LOCK_KEY) return false
  const owner = readLeaseOwner(newValue)
  return owner != null && owner !== tabId
}

export function browserLeaseStorage(): LeaseStorage | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}
