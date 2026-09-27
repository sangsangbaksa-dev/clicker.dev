/**
 * Two-step confirmations (true ending, completion wipe) swap the arming button for the
 * irreversible one in the same spot. A double-click or a held Enter would press both,
 * so the second step ignores presses until it has been on screen for a moment.
 */
export const CONFIRM_ARM_MS = 600

/** Whether a press at `now` counts, for a button that appeared at `shownAt` (ms). */
export function isConfirmReady(shownAt: number | null, now: number, armMs = CONFIRM_ARM_MS): boolean {
  if (shownAt == null || !Number.isFinite(shownAt) || !Number.isFinite(now)) return false
  // A clock that jumped backwards should not lock the button forever.
  if (now < shownAt) return true
  return now - shownAt >= armMs
}
