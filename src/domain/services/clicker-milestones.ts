/**
 * Producer milestones: every time a producer's owned count reaches one of these, its output
 * doubles (so ×2 at 10, ×4 at 25, ×8 at 50, ×16 at 100, ×32 at 200). Pure rules, no state.
 */
export const PRODUCER_MILESTONES = [10, 25, 50, 100, 200] as const

/** Output multiplier from milestones for `owned` copies of one producer. */
export function milestoneMultiplier(owned: number): number {
  let m = 1
  for (const n of PRODUCER_MILESTONES) if (owned >= n) m *= 2
  return m
}

/** How many milestones `owned` copies have passed. */
export function milestonesReached(owned: number): number {
  return PRODUCER_MILESTONES.filter((n) => owned >= n).length
}

/** The next count that doubles output, or null once all are passed. */
export function nextMilestone(owned: number): number | null {
  return PRODUCER_MILESTONES.find((n) => owned < n) ?? null
}

/** The highest milestone a purchase just crossed (before < n <= after), or null. */
export function crossedMilestone(before: number, after: number): number | null {
  let hit: number | null = null
  for (const n of PRODUCER_MILESTONES) if (before < n && after >= n) hit = n
  return hit
}
