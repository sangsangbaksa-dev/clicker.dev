import type { SkillBranch, UpgradeCategory } from "../entities/clicker.ts"

export type SkillBranchTheme = {
  readonly branch: SkillBranch
  /** Short UI label (Korean). */
  readonly label: string
  readonly glyph: string
  /** Primary accent for nodes, lines, tabs, and icon rims. */
  readonly accent: string
}

/**
 * Five skill branches around the hub — one accent each, kept in domain so UI and FX stay aligned.
 * AUTOMATION is the production / auto-generate branch (green).
 */
export const SKILL_BRANCH_THEMES: readonly SkillBranchTheme[] = [
  { branch: "FOCUS", label: "직접 개입", glyph: "⚡", accent: "#22d3ee" },
  { branch: "AUTOMATION", label: "자동화", glyph: "⚙", accent: "#34d399" },
  { branch: "RESONANCE", label: "공명", glyph: "◎", accent: "#c084fc" },
  { branch: "HUNT", label: "사냥", glyph: "⚔", accent: "#fb7185" },
  { branch: "TRANSCENDENCE", label: "초월", glyph: "✦", accent: "#fbbf24" },
]

/** Pentagon layout order (clockwise from top). */
export const SKILL_BRANCH_ORDER: SkillBranch[] = SKILL_BRANCH_THEMES.map((t) => t.branch)

const themeByBranch = Object.fromEntries(SKILL_BRANCH_THEMES.map((t) => [t.branch, t])) as Record<
  SkillBranch,
  SkillBranchTheme
>

export const SKILL_BRANCH_LABEL: Record<SkillBranch, string> = Object.fromEntries(
  SKILL_BRANCH_THEMES.map((t) => [t.branch, t.label]),
) as Record<SkillBranch, string>

export const SKILL_BRANCH_COLOR: Record<SkillBranch, string> = Object.fromEntries(
  SKILL_BRANCH_THEMES.map((t) => [t.branch, t.accent]),
) as Record<SkillBranch, string>

export const SKILL_BRANCH_GLYPH: Record<SkillBranch, string> = Object.fromEntries(
  SKILL_BRANCH_THEMES.map((t) => [t.branch, t.glyph]),
) as Record<SkillBranch, string>

export function skillBranchTheme(branch: SkillBranch): SkillBranchTheme {
  return themeByBranch[branch]
}

export function skillBranchAccent(branch: SkillBranch): string {
  return themeByBranch[branch].accent
}

/** CSS custom property map for branch-tinted surfaces. */
export function skillBranchCssVars(branch: SkillBranch): { "--branch-color": string } {
  return { "--branch-color": skillBranchAccent(branch) }
}

const SKILL_BRANCH_SET = new Set<string>(SKILL_BRANCH_ORDER)

/** Purchase burst accent: skill branches use branch color; upgrade tabs reuse the closest branch hue. */
export function purchaseFxAccent(kind: string): string {
  const key = kind.toUpperCase()
  if (SKILL_BRANCH_SET.has(key)) return skillBranchAccent(key as SkillBranch)
  const fromUpgrade: Partial<Record<UpgradeCategory, SkillBranch>> = {
    CLICK: "FOCUS",
    PRODUCTION: "AUTOMATION",
    FEVER: "HUNT",
    UTILITY: "RESONANCE",
  }
  const mapped = fromUpgrade[key as UpgradeCategory]
  return mapped ? skillBranchAccent(mapped) : SKILL_BRANCH_COLOR.FOCUS
}
