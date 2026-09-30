import type { ClickerPersistencePort } from "@/application/ports/clicker-persistence"
import type { ClickerTabLockPort } from "@/application/ports/clicker-tab-lock"

let persistence: ClickerPersistencePort | null = null
let tabLock: ClickerTabLockPort | null = null

export function bindClickerPersistence(port: ClickerPersistencePort): void {
  persistence = port
}

export function bindClickerTabLock(port: ClickerTabLockPort): void {
  tabLock = port
}

export function clickerPersistence(): ClickerPersistencePort {
  if (!persistence) throw new Error("Clicker persistence is not bound")
  return persistence
}

export function clickerTabLock(): ClickerTabLockPort {
  if (!tabLock) throw new Error("Clicker tab lock is not bound")
  return tabLock
}
