import type { ActiveSkillDef, GameConfig, MetaState, RunState, SkillTree } from "../entities/clicker"

/*
 * Special skills: unlocked by rebirth count (not bought), no charges, limited only by their
 * cooldown. Two colour groups — mining (blue) and production (green) — shared by every active
 * skill, so the icon border, the cooldown wedge and the cast nova always agree.
 */

/** The one place the skill colours live. */
export const SKILL_TREE_COLOR: Record<SkillTree, { main: string; glow: string }> = {
  mining: { main: "#38A8FF", glow: "#7FD0FF" },
  production: { main: "#3DDC84", glow: "#8DF0B4" },
}

/** Mining (blue) when the skill boosts clicks, production (green) otherwise; `tree` wins. */
export function skillTreeOf(def: ActiveSkillDef): SkillTree {
  if (def.tree) return def.tree
  return def.clickMultiplier || def.burstClicks || def.freezeMine || def.unlocksFever ? "mining" : "production"
}

export function skillColor(def: ActiveSkillDef): { main: string; glow: string } {
  return SKILL_TREE_COLOR[skillTreeOf(def)]
}

/** `rgb(r g b / a)` of the tree's main colour, for the full-screen cast nova. */
export function skillNovaColor(def: ActiveSkillDef, alpha = 0.9): string {
  const hex = skillColor(def).main.slice(1)
  const n = Number.parseInt(hex, 16)
  return `rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255} / ${alpha})`
}

export function isSpecialSkill(def: ActiveSkillDef): boolean {
  return def.unlockRebirth !== undefined
}

export function specialSkillUnlocked(def: ActiveSkillDef, meta: MetaState): boolean {
  return isSpecialSkill(def) && meta.rebirthCount >= (def.unlockRebirth ?? 0)
}

/** Gauge FEVER needs a passive "unlocks fever" skill; a config without one leaves FEVER open. */
export function gaugeFeverUnlocked(meta: MetaState, config: GameConfig): boolean {
  const gates = config.activeSkills.filter((s) => s.unlocksFever)
  return gates.length === 0 || gates.some((s) => specialSkillUnlocked(s, meta))
}

/** Charges shown/used for a skill; special skills never run out. */
export function skillCharges(run: RunState, def: ActiveSkillDef): number {
  return isSpecialSkill(def) ? Number.POSITIVE_INFINITY : (run.skillItems[def.id] ?? 0)
}

/**
 * Skills on the cast rail: shop skills the player holds (or that are still cooling/running),
 * then unlocked special skills that can be cast. Passive ones (FEVER unlock) never appear.
 */
export function ownedActiveSkills(run: RunState, meta: MetaState, config: GameConfig, now: number): ActiveSkillDef[] {
  const shop = config.activeSkills.filter(
    (s) =>
      !isSpecialSkill(s) &&
      (s.id in run.skillItems ||
        (run.skillCooldowns[s.id] ?? 0) > 0 ||
        run.activeBuffs.some((b) => b.id === s.id && b.expiresAt > now)),
  )
  const special = config.activeSkills.filter((s) => specialSkillUnlocked(s, meta) && !s.unlocksFever)
  return [...shop, ...special]
}
