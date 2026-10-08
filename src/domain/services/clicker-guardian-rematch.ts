/**
 * 각성 수호자 (pure): the guardian rematch of 새벽의 광산. Opens only once the dawn mine is open,
 * grows tougher with dawn depth and pays 새벽 조각. It reuses the normal guardian fight (same timer,
 * same blows); only the health and the reward are its own. Nothing here runs before the ending.
 */
import type { BossFight, MetaState } from "../entities/clicker.ts"
import { getDawnDepth, postgameActive } from "./clicker-postgame.ts"

export const AWAKENED_GUARDIAN_NAME = "각성 수호자"
/** Health × the normal guardian's at depth 0… */
export const AWAKENED_HP_BASE = 2
/** …and this much more per dawn depth. */
export const AWAKENED_HP_GROWTH = 1.2
/** Shards for a win at depth 0, plus one more every this many depths. */
export const AWAKENED_REWARD_BASE = 3
export const AWAKENED_REWARD_EVERY = 5

const whole = (n: number) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0)

export function awakenedGuardianAvailable(meta: MetaState): boolean {
  return postgameActive(meta)
}

export function awakenedHpMultiplier(depth: number): number {
  return AWAKENED_HP_BASE * AWAKENED_HP_GROWTH ** whole(depth)
}

export function awakenedReward(depth: number): number {
  return AWAKENED_REWARD_BASE + Math.floor(whole(depth) / AWAKENED_REWARD_EVERY)
}

/** Player-facing name with its stage, e.g. "각성 수호자 · 깊이 3". */
export function awakenedGuardianLabel(depth: number): string {
  return `${AWAKENED_GUARDIAN_NAME} · 깊이 ${whole(depth)}`
}

export function isAwakenedFight(fight: BossFight | null | undefined): boolean {
  return Boolean(fight?.awakened)
}

/** Turn a freshly started guardian fight into the awakened one for the current dawn depth. */
export function awakenFight(fight: BossFight, meta: MetaState): BossFight {
  const depth = getDawnDepth(meta)
  const hp = fight.maxHp * awakenedHpMultiplier(depth)
  return { ...fight, hp, maxHp: hp, awakened: true, awakenedDepth: depth }
}

/** Pay the win: shards go to the dawn mine, the win is counted. No-op outside the dawn mine. */
export function claimAwakenedVictory(meta: MetaState, fight: BossFight): { meta: MetaState; reward: number } {
  if (!postgameActive(meta) || !fight.awakened) return { meta, reward: 0 }
  const reward = awakenedReward(fight.awakenedDepth ?? getDawnDepth(meta))
  const pg = meta.postgame!
  return {
    meta: { ...meta, postgame: { ...pg, shards: pg.shards + reward, awakenedWins: (pg.awakenedWins ?? 0) + 1 } },
    reward,
  }
}

/** Wins against the awakened guardian (selector for achievements). */
export function getAwakenedWins(meta: MetaState): number {
  return postgameActive(meta) ? meta.postgame!.awakenedWins ?? 0 : 0
}

/** Text alternative for the roar cue (never sound-only). */
export const AWAKENED_ROAR_TEXT = "각성 수호자가 포효한다!"
