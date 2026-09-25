import type { RegionChallengeKind } from "@/domain/entities/clicker"

/** Target schedule shared by the mini-games and their scoring. */
export const ROD_FIRST_MS = 300
export const ROD_EVERY_MS = 850
export const DRILL_TARGET = 10
export const DRONE_FIRST_MS = 200
export const DRONE_EVERY_MS = 650

/** Targets presented by `elapsed` ms of play; misses (wrong taps / cracks) cost half an attempt. */
export function challengeAttempts(kind: RegionChallengeKind, elapsed: number, hits: number, misses: number): number {
  if (kind === "ROD_STRIKE") return Math.max(0, Math.floor((elapsed - ROD_FIRST_MS) / ROD_EVERY_MS) + 1) + misses * 0.5
  if (kind === "FAULT_DRILL") return Math.max(DRILL_TARGET, hits) + misses * 0.5
  return Math.max(0, Math.floor((elapsed - DRONE_FIRST_MS) / DRONE_EVERY_MS) + 1)
}

/** Success ratio 0..1 of hits against the targets presented by `elapsed`. */
export function challengeScore(kind: RegionChallengeKind, elapsed: number, hits: number, misses: number): number {
  const tries = challengeAttempts(kind, elapsed, hits, misses)
  if (tries <= 0) return 0
  return Math.min(1, Math.min(hits, kind === "FAULT_DRILL" ? DRILL_TARGET : hits) / tries)
}

/**
 * Score that is actually paid out. Targets the run would still have shown count as missed,
 * so leaving right after a lucky first hit can't cash in a full-run reward.
 */
export function settledChallengeScore(
  kind: RegionChallengeKind,
  durationMs: number,
  hits: number,
  misses: number
): number {
  return challengeScore(kind, durationMs, hits, misses)
}
