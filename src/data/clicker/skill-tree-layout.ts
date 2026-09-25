import type { SkillBranch } from "@/domain/entities/clicker"

/** Percent positions inside the skill tree canvas (0–100). */
export const SKILL_TREE_HUB = { x: 50, y: 50 }

export const SKILL_TREE_LAYOUT: Record<string, { x: number; y: number }> = {
  focus_click: { x: 22, y: 12 },
  focus_crit: { x: 10, y: 26 },
  focus_combo: { x: 24, y: 38 },
  focus_press: { x: 12, y: 50 },
  focus_edge: { x: 26, y: 62 },
  mine_dwell: { x: 38, y: 18 },
  mine_extend: { x: 42, y: 32 },
  mine_marathon: { x: 36, y: 46 },
  auto_prod: { x: 16, y: 74 },
  auto_more: { x: 30, y: 84 },
  auto_loop: { x: 14, y: 92 },
  auto_surge: { x: 32, y: 96 },
  reso_fever: { x: 78, y: 14 },
  reso_intense: { x: 90, y: 28 },
  reso_linger: { x: 76, y: 42 },
  reso_spark: { x: 88, y: 56 },
  trans_start: { x: 82, y: 78 },
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
