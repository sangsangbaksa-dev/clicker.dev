/*
 * Game sound events (application layer). Call sites say WHAT happened; an adapter bound by the
 * infrastructure layer decides which file plays. No value imports here so it stays testable.
 */
export const GAME_SFX_EVENTS = [
  "uiTap",
  "uiPurchase",
  "upgrade",
  "producerBuy",
  "skillUnlock",
  "skillSeismicWave",
  "skillOverdrive",
  "skillPulseBurst",
  "skillFeverStart",
  "skillTimeStop",
  "skillCoreOverload",
  "coreHit",
  "coreHitHeavy",
  "enterMine",
  "exitMine",
  "rebirthOpen",
  "rebirthStamp",
  "rebirthComplete",
  "monsterAppear",
  "monsterHit",
  "monsterDefeat",
  "bossAppear",
  "bossHit",
  "bossPhaseChange",
  "bossDefeat",
  "sessionTimerEnd",
  "rebirthCollapse",
  "rebirthVoidTear",
  "rebirthRebuild",
  "rebirthSettle",
  "skillAssemblyLine",
  "skillOverclockGrid",
  "shopSkillUse",
] as const

export type GameSfxEvent = (typeof GAME_SFX_EVENTS)[number]

/** Port implemented in infrastructure (Web Audio + legacy-0929 files). */
export type ClickerSfxPort = {
  /** True when the sample played (or SFX are muted); false → caller may use a synth fallback. */
  play(event: GameSfxEvent): boolean
  /** Core tap: the click ogg pair plus the light/heavy core thump. */
  strike(muted: boolean, critical: boolean): void
  /** Decode every sample ahead of time (after a user gesture). */
  warm(): void
  /** Keep exactly these sustain loops running (others stop). Missing files are skipped silently. */
  syncLoops(active: readonly GameSfxLoop[]): void
}

/** Sustain loops that play while a skill buff is up. */
export const GAME_SFX_LOOPS = ["assemblyLine", "overclockGrid"] as const
export type GameSfxLoop = (typeof GAME_SFX_LOOPS)[number]

let port: ClickerSfxPort | null = null

export function bindClickerSfxPort(next: ClickerSfxPort | null): void {
  port = next
}

export function playGameSfx(event: GameSfxEvent): boolean {
  return port?.play(event) ?? false
}

export function playCoreStrike(muted: boolean, critical: boolean): void {
  port?.strike(muted, critical)
}

export function warmGameSfx(): void {
  port?.warm()
}

/** Run the sustain loop of every active buff in `skillIds` and stop the rest. */
export function syncSkillLoops(skillIds: readonly string[]): void {
  const active = skillIds.map((id) => SKILL_LOOPS[id]).filter((l): l is GameSfxLoop => Boolean(l))
  port?.syncLoops(active)
}

const SKILL_EVENTS: Record<string, GameSfxEvent> = {
  seismic_wave: "skillSeismicWave",
  overdrive: "skillOverdrive",
  pulse_burst: "skillPulseBurst",
  fever_core: "skillFeverStart",
  time_freeze: "skillTimeStop",
  core_overload: "skillCoreOverload",
  assembly_line: "skillAssemblyLine",
  overclock_grid: "skillOverclockGrid",
}

const SKILL_LOOPS: Record<string, GameSfxLoop> = {
  assembly_line: "assemblyLine",
  overclock_grid: "overclockGrid",
}

/** Sound event of a special skill; shop skills have none here (they use `shopSkillUse`). */
export function skillSfxEvent(skillId: string): GameSfxEvent | null {
  return SKILL_EVENTS[skillId] ?? null
}

/** Play the event's file; when it is not ready / missing run the synth fallback instead. */
export function playGameSfxOr(event: GameSfxEvent, fallback: () => void): void {
  if (!playGameSfx(event)) fallback()
}
