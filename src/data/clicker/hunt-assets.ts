import type { MonsterKind } from "../../domain/services/clicker-region-activity.ts"

/**
 * Signal Relay monster sprites (black background, composited with `screen`).
 * Kinds without art fall back to the CSS-drawn silhouette in clicker-hunt.css.
 */
export const MONSTER_ART: Partial<Record<MonsterKind, string>> = {}
