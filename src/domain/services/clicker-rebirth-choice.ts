/**
 * Worldline choice gate (pure): one pick per rebirth. A double-click, a held Enter, or a second row
 * pressed inside the confirm flash must not queue a second choice.
 */

export type RebirthChoiceState = { status: "idle" } | { status: "locked"; id: string }

export const REBIRTH_CHOICE_IDLE: RebirthChoiceState = { status: "idle" }

export type RebirthChoiceResult =
  | { accepted: true; state: RebirthChoiceState }
  | { accepted: false; state: RebirthChoiceState; reason: "busy" | "owned" | "unknown" }

export function pickRebirthWorldline(
  state: RebirthChoiceState,
  id: string,
  ownedIds: readonly string[],
  knownIds: readonly string[],
): RebirthChoiceResult {
  if (state.status === "locked") return { accepted: false, state, reason: "busy" }
  if (!knownIds.includes(id)) return { accepted: false, state, reason: "unknown" }
  if (ownedIds.includes(id)) return { accepted: false, state, reason: "owned" }
  return { accepted: true, state: { status: "locked", id } }
}

export function releaseRebirthChoice(): RebirthChoiceState {
  return REBIRTH_CHOICE_IDLE
}

/** Short confirm flash before the ceremony opens; none when the player prefers reduced motion. */
export function rebirthConfirmDelayMs(reducedMotion: boolean): number {
  return reducedMotion ? 0 : 180
}
