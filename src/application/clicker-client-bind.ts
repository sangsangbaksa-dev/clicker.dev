import type { ClickerPersistencePort } from "./ports/clicker-persistence.ts"
import type { ClickerTabLockPort } from "./ports/clicker-tab-lock.ts"
import {
  clickerPersistenceFallback,
  clickerTabLockFallback,
  resetClickerClientFallbackState,
} from "./clicker-client-fallbacks.ts"

let persistence: ClickerPersistencePort | null = null
let tabLock: ClickerTabLockPort | null = null

export function bindClickerPersistence(port: ClickerPersistencePort): void {
  persistence = port
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

/** Test-only: clear bindings so each test can install fakes. */
export function resetClickerClientBindings(): void {
  persistence = null
  tabLock = null
  resetClickerClientFallbackState()
}
