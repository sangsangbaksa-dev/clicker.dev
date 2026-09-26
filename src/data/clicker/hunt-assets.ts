import type { MonsterKind } from "../../domain/services/clicker-hunt.ts"

/**
 * Signal Relay monster sprites: transparent vector art with built-in idle loops
 * (rotor, cloak sway, core pulse) that respect prefers-reduced-motion.
 * Kinds without art fall back to the CSS-drawn silhouette in clicker-region-challenge.css.
 */
export const MONSTER_ART: Partial<Record<MonsterKind, string>> = {
  drone: "/clicker/monster/monster_drone.svg",
  wraith: "/clicker/monster/monster_wraith.svg",
  brute: "/clicker/monster/monster_brute.svg",
}
