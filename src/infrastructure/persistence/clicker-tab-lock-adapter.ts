import type { ClickerTabLockPort } from "@/application/ports/clicker-tab-lock"
import {
  browserLeaseStorage,
  canWriteClickerSave,
  claimClickerLease,
  createClickerTabId,
  isLeaseTakenByOther,
} from "@/infrastructure/persistence/clicker-tab-lock"

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
