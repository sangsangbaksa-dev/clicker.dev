/** Legacy anonymous progress (single browser install). */
export const CLICKER_SAVE_BASE_KEY = "aurelia-clicker-save-v1"

export function clickerSaveStorageKey(loginId: string | null): string {
  if (!loginId) return CLICKER_SAVE_BASE_KEY
  return `${CLICKER_SAVE_BASE_KEY}:acct:${loginId}`
}

export type ClickerSaveHandoffPlan =
  | { kind: "switch-only" }
  | { kind: "copy-guest-into-account" }
  | { kind: "mirror-account-to-guest-on-logout" }

/** Decide how to move raw saves when the active account changes. */
export function planClickerSaveHandoff(
  previousLoginId: string | null,
  nextLoginId: string | null,
  guestHasSave: boolean,
  accountHasSave: boolean,
): ClickerSaveHandoffPlan {
  if (previousLoginId === nextLoginId) return { kind: "switch-only" }
  if (nextLoginId && !previousLoginId && !accountHasSave && guestHasSave) {
    return { kind: "copy-guest-into-account" }
  }
  if (!nextLoginId && previousLoginId) {
    return { kind: "mirror-account-to-guest-on-logout" }
  }
  return { kind: "switch-only" }
}
