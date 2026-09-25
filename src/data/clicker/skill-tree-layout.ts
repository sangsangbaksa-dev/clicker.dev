import type { SkillBranch } from "@/domain/entities/clicker"

/** Percent positions inside the skill tree canvas (0–100). */
export const SKILL_TREE_HUB = { x: 50, y: 50 }

/**
 * Quadrants around the hub: FOCUS top-left, RESONANCE top-right,
 * AUTOMATION bottom-left, TRANSCENDENCE bottom-right. Depth grows away from the hub.
 */
export const SKILL_TREE_LAYOUT: Record<string, { x: number; y: number }> = {
  focus_click: { x: 40, y: 43 },
  focus_crit: { x: 32, y: 43 },
  focus_combo: { x: 24, y: 43 },
  focus_press: { x: 16, y: 43 },
  focus_edge: { x: 8, y: 43 },
  focus_amp: { x: 8, y: 33 },
  focus_lethal: { x: 18, y: 33 },
  focus_chain: { x: 8, y: 22 },
  focus_pinpoint: { x: 28, y: 29 },
  focus_rhythm: { x: 14, y: 13 },
  focus_breaker: { x: 26, y: 18 },
  focus_apex: { x: 26, y: 7 },
  mine_dwell: { x: 44, y: 35 },
  mine_extend: { x: 38, y: 27 },
  mine_marathon: { x: 44, y: 19 },
  mine_deepcut: { x: 38, y: 12 },
  mine_endless: { x: 45, y: 6 },
  reso_fever: { x: 60, y: 43 },
  reso_intense: { x: 68, y: 43 },
  reso_linger: { x: 76, y: 43 },
  reso_spark: { x: 84, y: 43 },
  reso_chorus: { x: 92, y: 33 },
  reso_finale: { x: 78, y: 33 },
  reso_amplify: { x: 90, y: 23 },
  reso_brink: { x: 72, y: 24 },
  reso_array: { x: 92, y: 13 },
  reso_storm: { x: 82, y: 8 },
  reso_apex: { x: 68, y: 10 },
  auto_prod: { x: 40, y: 57 },
  auto_more: { x: 32, y: 57 },
  auto_loop: { x: 24, y: 57 },
  auto_surge: { x: 16, y: 57 },
  auto_drill: { x: 36, y: 66 },
  auto_drill2: { x: 42, y: 75 },
  auto_early: { x: 8, y: 66 },
  auto_mesh: { x: 20, y: 67 },
  auto_factory: { x: 14, y: 77 },
  auto_drill3: { x: 30, y: 82 },
  auto_mid: { x: 8, y: 87 },
  auto_overflow: { x: 18, y: 93 },
  auto_late: { x: 30, y: 94 },
  auto_apex: { x: 42, y: 90 },
  trans_start: { x: 60, y: 58 },
  trans_seed2: { x: 74, y: 62 },
  trans_echo: { x: 64, y: 72 },
  trans_insight: { x: 58, y: 86 },
  trans_vault: { x: 88, y: 72 },
  trans_convergence: { x: 76, y: 88 },
}

export const SKILL_BRANCH_LABEL: Record<SkillBranch, string> = {
  FOCUS: "직접 개입",
  AUTOMATION: "자동화",
  RESONANCE: "공명",
  TRANSCENDENCE: "초월",
}

export const SKILL_BRANCH_COLOR: Record<SkillBranch, string> = {
  FOCUS: "#62d8eb",
  AUTOMATION: "#6fd9b0",
  RESONANCE: "#a98cff",
  TRANSCENDENCE: "#e8c468",
}

export const SKILL_BRANCH_GLYPH: Record<SkillBranch, string> = {
  FOCUS: "⚡",
  AUTOMATION: "⚙",
  RESONANCE: "◎",
  TRANSCENDENCE: "✦",
}
