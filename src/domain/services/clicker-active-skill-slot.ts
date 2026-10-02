/** Bottom action bar skill button visual / interaction state (not mine hotbar buff state). */
export type ActiveSkillBarState = "crisis" | "cooldown" | "empty" | "ready"

export function resolveActiveSkillBarState(input: {
  crisisActive: boolean
  cooldownMs: number
  charges: number
}): ActiveSkillBarState {
  if (input.crisisActive) return "crisis"
  if (input.cooldownMs > 0) return "cooldown"
  if (input.charges <= 0) return "empty"
  return "ready"
}

export function isActiveSkillBarDisabled(state: ActiveSkillBarState): boolean {
  return state === "crisis" || state === "cooldown" || state === "empty"
}

/** Short line for aria-label: e.g. `3 · 준비`. */
export function activeSkillBarStatusLine(state: ActiveSkillBarState, charges: number): string {
  const tag =
    state === "cooldown"
      ? "쿨다운"
      : state === "crisis"
        ? "위기"
        : state === "empty"
          ? "없음"
          : "준비"
  return `${Number.isFinite(charges) ? charges : "∞"} · ${tag}`
}

/** Label under the skill name in the button. */
export function activeSkillBarShortLabel(state: ActiveSkillBarState): string {
  if (state === "ready") return "준비"
  if (state === "cooldown") return "쿨다운"
  if (state === "empty") return "없음"
  return "위기"
}

/** Tooltip hint under the description. */
export function activeSkillBarHint(state: ActiveSkillBarState): string {
  if (state === "ready") return "준비됨 · 탭하여 사용"
  if (state === "cooldown") return "쿨다운이 끝나면 다시 사용"
  if (state === "empty") return "충전 없음 · 상점에서 충전"
  return "위기 중 사용 불가"
}
