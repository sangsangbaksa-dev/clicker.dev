import type { AchievementKind, LateGameAchievementKind, MetaState } from "../entities/clicker"
import { getDawnDepth } from "./clicker-postgame.ts"

/**
 * Late-game achievement progress. Pure; depends on the dawn-mine (#1 postgame)
 * only through PostgameDepthReader, so it is safe when that feature is absent.
 */
export type PostgameDepthReader = (meta: MetaState) => number

/** Fallback-safe selector: reads `meta.postgame?.depth` if present, otherwise 0 (kept for tests / partial saves). */
export const optionalPostgameDepth: PostgameDepthReader = (meta) => {
  const pg = (meta as MetaState & { postgame?: { depth?: unknown } | null }).postgame
  const d = pg && typeof pg === "object" ? pg.depth : undefined
  return typeof d === "number" && Number.isFinite(d) && d > 0 ? Math.floor(d) : 0
}

/** Default port adapter: #1 `getDawnDepth`, guarded by the fallback-safe selector. */
export const dawnDepthReader: PostgameDepthReader = (meta) => {
  const d = getDawnDepth(meta)
  return typeof d === "number" && Number.isFinite(d) && d > 0 ? Math.floor(d) : optionalPostgameDepth(meta)
}

const LATE_KINDS: ReadonlySet<string> = new Set<LateGameAchievementKind>([
  "BOSS", "ENDING", "TRANSCENDENCE", "RELIC_LEVELS", "GACHA_PULLS", "GACHA_LEGENDARY", "POSTGAME_DEPTH",
])

export function isLateGameKind(kind: AchievementKind): kind is LateGameAchievementKind {
  return LATE_KINDS.has(kind)
}

export function lateGameProgress(
  kind: LateGameAchievementKind,
  meta: MetaState,
  readDepth: PostgameDepthReader = dawnDepthReader,
): number {
  switch (kind) {
    case "BOSS":
      return meta.bossDefeated ? 1 : 0
    case "ENDING":
      return meta.gameCompleted ? 1 : 0
    case "TRANSCENDENCE":
      return new Set(meta.transcendenceIds ?? []).size
    case "RELIC_LEVELS":
      return Object.values(meta.relicLevels ?? {}).reduce((s, n) => s + (Number.isFinite(n) && n > 0 ? n : 0), 0)
    case "GACHA_PULLS":
      return meta.gachaPulls ?? 0
    case "GACHA_LEGENDARY":
      return meta.gachaCounts?.legendary ?? 0
    case "POSTGAME_DEPTH":
      return readDepth(meta)
  }
}
