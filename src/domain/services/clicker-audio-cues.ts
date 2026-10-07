import type { UpgradeNavTabId } from "./clicker-upgrade-nav.ts"

/*
 * File-based sound cues (pure data + rules). One line per cue in CUE_REGISTRY: which mp3, at what
 * playback gain, looped or not. Playback (HTMLAudioElement), mute and autoplay handling live in
 * the infrastructure adapter; components only ask "which cue for this event" here.
 *
 * Gain policy (Waldusic's volume maps, 2026-10-04):
 *  - `_norm` files already carry their correction gain  -> gainDb 0.
 *  - other files use the recommended gain of volume-map.json.
 *  - loops are not in volume-map.json (peak -10 dBFS by design)  -> gainDb 0, level set by the file.
 * Every gain is <= 0 dB because HTMLAudioElement.volume cannot amplify.
 */

export const CUE_PUBLIC_DIR = "/clicker/audio/"

export type CueId =
  | "tabMonster"
  | "tabRebirth"
  | "tabDrill"
  | "drillStart"
  | "drillComplete"
  | "drillLoop"
  | "bossAppear"
  | "bossRoar"
  | "bossBreathLoop"
  | "bossStomp"
  | "bossHit"
  | "bossEnrage"
  | "bossDefeat"
  | "dawnDepth"
  | "dawnDepthBig"
  | "awakenedRoar"

export type CueDef = {
  /** File name inside CUE_PUBLIC_DIR. */
  readonly file: string
  /** Playback gain in dB (see the policy above). */
  readonly gainDb: number
  readonly loop: boolean
  /** Rapid-fire guard: the same cue is ignored if it fired less than this long ago. */
  readonly minGapMs?: number
}

export const CUE_REGISTRY: Readonly<Record<CueId, CueDef>> = {
  tabMonster: { file: "sfx_tab_monster_v1.mp3", gainDb: -6.8, loop: false, minGapMs: 80 },
  tabRebirth: { file: "sfx_tab_rebirth_v1.mp3", gainDb: -10.4, loop: false, minGapMs: 80 },
  tabDrill: { file: "sfx_tab_drill_v1.mp3", gainDb: -8.9, loop: false, minGapMs: 80 },
  drillStart: { file: "sfx_drill_start_v1.mp3", gainDb: -4.0, loop: false },
  drillComplete: { file: "sfx_drill_complete_v1.mp3", gainDb: -2.7, loop: false },
  drillLoop: { file: "sfx_drill_loop_v1.mp3", gainDb: 0, loop: true },
  bossAppear: { file: "sfx_finalboss_appear_v1_norm.mp3", gainDb: 0, loop: false },
  bossRoar: { file: "sfx_finalboss_roar_v1.mp3", gainDb: -2.4, loop: false },
  bossBreathLoop: { file: "sfx_finalboss_breath_loop_v1.mp3", gainDb: 0, loop: true },
  bossStomp: { file: "sfx_finalboss_stomp_v1_norm.mp3", gainDb: 0, loop: false, minGapMs: 200 },
  bossHit: { file: "sfx_finalboss_hit_v1_norm.mp3", gainDb: 0, loop: false, minGapMs: 120 },
  bossEnrage: { file: "sfx_finalboss_enrage_v1_norm.mp3", gainDb: 0, loop: false },
  bossDefeat: { file: "sfx_finalboss_collapse_v1_norm.mp3", gainDb: 0, loop: false },
  // 새벽의 광산 (Waldusic 2026-10-07): depth milestone -4 dB, every 10th depth -2 dB.
  dawnDepth: { file: "sfx_dawn_depth_milestone_v1.mp3", gainDb: -4, loop: false, minGapMs: 400 },
  dawnDepthBig: { file: "sfx_dawn_depth_milestone_big_v1.mp3", gainDb: -2, loop: false, minGapMs: 400 },
  // 각성 수호자 roar: LUFS -7.9, 2.7 dB hotter than the final-boss roar (played at -2.4) -> -5.1 to match.
  awakenedRoar: { file: "sfx_guardian_awakened_roar_v1.mp3", gainDb: -5.1, loop: false },
}

export const ALL_CUE_IDS = Object.keys(CUE_REGISTRY) as CueId[]

export const cueUrl = (id: CueId): string => CUE_PUBLIC_DIR + CUE_REGISTRY[id].file

/** dB -> linear volume for HTMLAudioElement (0..1; boosts are clamped, the registry never asks for one). */
export function cueVolume(id: CueId): number {
  const lin = 10 ** (CUE_REGISTRY[id].gainDb / 20)
  return Number.isFinite(lin) ? Math.min(1, Math.max(0, lin)) : 0
}

/* ---------- upgrade nav tabs ---------- */

const NAV_TAB_CUE: Partial<Record<UpgradeNavTabId, CueId>> = {
  MONSTER: "tabMonster",
  REBIRTH: "tabRebirth",
  DRILL: "tabDrill",
}

/** Cue for a nav pill; the four upgrade filters stay on the generic button click. */
export function navTabCue(id: UpgradeNavTabId): CueId | null {
  return NAV_TAB_CUE[id] ?? null
}

/* ---------- core drill rig ---------- */

/** The drill hum stops this long after the last tap (the gauge has no timer of its own). */
export const DRILL_LOOP_IDLE_MS = 1200

export type DrillTapPlan = { readonly play: readonly CueId[]; readonly loop: "start" | "keep" | "stop" }

/**
 * One accepted tap on the drill rig. `active`: the hum is running (a cycle is in progress).
 * `reward > 0` means this tap bored through the vein.
 */
export function drillTapPlan(active: boolean, reward: number): DrillTapPlan {
  if (reward > 0) return { play: ["drillComplete"], loop: "stop" }
  if (!active) return { play: ["drillStart"], loop: "start" }
  return { play: [], loop: "keep" }
}

export const drillLoopExpired = (sinceLastTapMs: number): boolean => sinceLastTapMs >= DRILL_LOOP_IDLE_MS

/* ---------- Core Guardian ---------- */

/** Enrage level (0..1, see enrageLevel) at which the enrage cue fires. */
export const GUARDIAN_ENRAGE_CUE_AT = 0.5

/** What the fight screen knows about the guardian right now; counters rise once per event. */
export type GuardianAudioSnap = {
  readonly fighting: boolean
  readonly hits: number
  readonly attacks: number
  readonly defeats: number
  readonly enrage: number
}

export type GuardianAudioPlan = { readonly play: readonly CueId[]; readonly breath: "start" | "stop" | null }

/**
 * Animation state -> cue: appear (fight starts) = appear + roar, idle (fighting) = breath loop,
 * hit = hit, lunge = stomp, enrage crossing the threshold = enrage, defeat = collapse.
 * `prev` null is the first observation (e.g. a fight restored from a save): no one-shots, just the bed.
 */
export function guardianAudioPlan(prev: GuardianAudioSnap | null, next: GuardianAudioSnap): GuardianAudioPlan {
  if (!prev) return { play: [], breath: next.fighting ? "start" : null }
  const play: CueId[] = []
  let breath: GuardianAudioPlan["breath"] = null
  if (!prev.fighting && next.fighting) {
    play.push("bossAppear", "bossRoar")
    breath = "start"
  }
  if (prev.fighting && !next.fighting) breath = "stop"
  if (next.defeats > prev.defeats) {
    play.push("bossDefeat")
    breath = "stop"
  } else if (next.fighting && next.hits > prev.hits) {
    play.push("bossHit")
  }
  if (next.fighting && next.attacks > prev.attacks) play.push("bossStomp")
  if (next.fighting && prev.enrage < GUARDIAN_ENRAGE_CUE_AT && next.enrage >= GUARDIAN_ENRAGE_CUE_AT) play.push("bossEnrage")
  return { play, breath }
}

/* ---------- 새벽의 광산 ---------- */

/** Cue for a new dawn depth: the big one on every 10th depth. */
export function dawnDepthCue(big: boolean): CueId {
  return big ? "dawnDepthBig" : "dawnDepth"
}
