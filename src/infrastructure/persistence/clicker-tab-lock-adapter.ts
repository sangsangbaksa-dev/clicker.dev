import type { ClickerTabLockPort } from "../../application/ports/clicker-tab-lock.ts"
import {
  browserLeaseStorage,
  canWriteClickerSave,
  claimClickerLease,
  createClickerTabId,
  isLeaseTakenByOther,
} from "./clicker-tab-lock.ts"

export const browserClickerTabLock: ClickerTabLockPort = {
  createTabId: createClickerTabId,
  leaseStorage: browserLeaseStorage,
  claimLease(tabId, now) {
    claimClickerLease(browserLeaseStorage(), tabId, now)
  },
  canWriteSave(tabId, now) {
    return canWriteClickerSave(browserLeaseStorage(), tabId, now)
  },
  isLeaseTakenByOther,
}
