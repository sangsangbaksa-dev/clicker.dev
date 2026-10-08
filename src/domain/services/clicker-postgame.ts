/**
 * Dawn Mine (pure): what is left to do after the true ending. The run keeps going; every chunk of
 * CORE mined after "계속하기" deepens the dawn mine by one level and pays one dawn shard.
 * No rebirths, no balance hooks: it only reads the CORE the existing engine already produced.
 */
import type { MetaState, PostgameState } from "../entities/clicker.ts"

/** First depth costs this share of the CORE gathered over the whole game… */
export const DAWN_FIRST_GOAL_SHARE = 0.01
/** …each next depth this much more. */
export const DAWN_GOAL_GROWTH = 1.6
/** Never ask for less than this (fresh/odd saves). */
export const DAWN_MIN_BASE = 1_000
/** Guard against runaway loops on absurd gains. */
const MAX_DEPTHS_PER_STEP = 1_000

const finitePos = (n: unknown): number => (typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0)

/** True once the dawn mine has been opened (player pressed 계속하기 after the ending). */
export function postgameActive(meta: MetaState): boolean {
  return Boolean(meta.gameCompleted && meta.postgame)
}

/** Ending is done (a completion flag for achievements and other features to hook). */
export function postgameCompleted(meta: MetaState): boolean {
  return Boolean(meta.gameCompleted)
}

/** Current dawn depth (0 until the dawn mine opens). Pure selector for achievements. */
export function getDawnDepth(meta: MetaState): number {
  return postgameActive(meta) ? meta.postgame!.depth : 0
}

/** Dawn shards earned so far. */
export function getDawnShards(meta: MetaState): number {
  return postgameActive(meta) ? meta.postgame!.shards : 0
}

/** The game accepts ticks and taps: before the ending, or after it in the dawn mine. */
export function canPlayAfterCompletion(meta: MetaState): boolean {
  return !meta.gameCompleted || postgameActive(meta)
}

/** The frozen completion screen is shown only for a completed game that has not opened the dawn mine. */
export function showsCompletionScreen(meta: MetaState): boolean {
  return Boolean(meta.gameCompleted) && !postgameActive(meta)
}

/** CORE needed to go from `depth` to `depth + 1`. */
export function postgameDepthGoal(depth: number, base: number): number {
  const d = Number.isFinite(depth) && depth > 0 ? Math.floor(depth) : 0
  return Math.max(DAWN_MIN_BASE, finitePos(base)) * DAWN_GOAL_GROWTH ** d
}

export function createPostgame(meta: MetaState, now: number): PostgameState {
  return { depth: 0, shards: 0, progress: 0, base: Math.max(DAWN_MIN_BASE, finitePos(meta.totalCoreEnergy) * DAWN_FIRST_GOAL_SHARE), startedAt: now }
}

/** Open the dawn mine after the true ending. */
export function continueAfterEnding(meta: MetaState, now: number): { meta: MetaState; error?: string } {
  if (!meta.gameCompleted) return { meta, error: "아직 엔딩을 보지 않았습니다." }
  if (meta.postgame) return { meta }
  return { meta: { ...meta, postgame: createPostgame(meta, now) } }
}

/** Feed CORE mined after the ending; returns the new meta and how many depths were gained. */
export function advancePostgame(meta: MetaState, gainedCore: number): { meta: MetaState; gainedDepths: number } {
  if (!postgameActive(meta)) return { meta, gainedDepths: 0 }
  const gained = finitePos(gainedCore)
  if (!gained) return { meta, gainedDepths: 0 }
  let { depth, shards, progress } = meta.postgame!
  const base = meta.postgame!.base
  progress += gained
  let gainedDepths = 0
  for (let goal = postgameDepthGoal(depth, base); progress >= goal && gainedDepths < MAX_DEPTHS_PER_STEP; goal = postgameDepthGoal(depth, base)) {
    progress -= goal
    depth += 1
    shards += 1
    gainedDepths += 1
  }
  return { meta: { ...meta, postgame: { ...meta.postgame!, depth, shards, progress } }, gainedDepths }
}

/** Save loading: anything malformed becomes "not opened"; numbers are clamped to sane values. */
export function sanitizePostgame(raw: unknown): PostgameState | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const r = raw as Record<string, unknown>
  const int = (n: unknown) => Math.floor(finitePos(n))
  return {
    depth: int(r.depth),
    shards: int(r.shards),
    progress: finitePos(r.progress),
    base: Math.max(DAWN_MIN_BASE, finitePos(r.base)),
    startedAt: typeof r.startedAt === "number" && Number.isFinite(r.startedAt) ? r.startedAt : 0,
    ...(int(r.awakenedWins) ? { awakenedWins: int(r.awakenedWins) } : {}),
  }
}

/** Every this many depths the milestone is "big" (for a stronger cue). */
export const DAWN_BIG_MILESTONE_EVERY = 10

/** Text announcement for reaching a new depth (screen readers get this; never sound-only). */
export function dawnDepthNotice(prevDepth: number, nextDepth: number): { text: string; big: boolean } | null {
  if (!(nextDepth > prevDepth)) return null
  const gained = nextDepth - prevDepth
  const big = Math.floor(nextDepth / DAWN_BIG_MILESTONE_EVERY) > Math.floor(prevDepth / DAWN_BIG_MILESTONE_EVERY)
  return { text: `새벽의 광산 · 깊이 ${nextDepth} 도달, 새벽 조각 +${gained}`, big }
}
