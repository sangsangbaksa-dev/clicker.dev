import type { BgmScene, BgmTrackId } from "./clicker-bgm.ts"

/*
 * BGM source registry (pure data + lookups). One entry per logical track: which file, which
 * format, looped or not. Playback (HTMLAudioElement), fading and autoplay handling live in the
 * application engine / infrastructure adapter; the UI only asks the domain which scene is on.
 *
 * Sources (Waldusic, 2026-10-04): `_seam` files are the seam-polished loops (first/last sample
 * equal, step across the loop point 0.0 in bgm-seam-report.json). Tracks without a seam twin keep
 * their previous file. Format is `mp3` for every loop: the wav twins are 7-8x larger (13-16 MB per
 * loop) and, played through a looping HTMLAudioElement, still leave a short gap at the wrap, so
 * flipping a loop to `format: "wav"` is a one-word data change (and apply-bgm-assets.sh --wav).
 */

export const BGM_PUBLIC_DIR = "/clicker/audio/"

export type BgmAudioFormat = "mp3" | "wav"

export type BgmTrackDef = {
  /** File name without extension inside BGM_PUBLIC_DIR. */
  readonly file: string
  readonly format: BgmAudioFormat
  /** Loops forever (false = plays once: rebirth intro, mine entrance). */
  readonly loop: boolean
  /** Known length of a one-shot track; beds use it to time the hand-over. */
  readonly durationMs?: number
  /** Manual loop wrap (seconds); used when gapless decode length differs from the musical loop. */
  readonly loopRegionSec?: { readonly start: number; readonly end: number }
}

export const BGM_TRACK_REGISTRY: Record<BgmTrackId, BgmTrackDef> = {
  loading: { file: "bgm_loading_loop_v2_seam", format: "mp3", loop: true },
  hub: { file: "bgm_hub_v2", format: "mp3", loop: true },
  mine: { file: "bgm_mine_loop_v3_seam", format: "mp3", loop: true },
  mineEnter: { file: "bgm_mine_enter_10s_seam", format: "mp3", loop: false, durationMs: 10_000 },
  chamber: { file: "bgm_chamber_v2", format: "mp3", loop: true },
  rebirthIntro: { file: "bgm_rebirth_hq_intro", format: "mp3", loop: false, durationMs: 9_000 },
  rebirthHq: { file: "bgm_rebirth_hq_loop_seam", format: "mp3", loop: true },
  boss: { file: "bgm_boss_loop_v1_seam", format: "mp3", loop: true },
  relay: { file: "bgm_world_relay", format: "mp3", loop: true },
  vault: { file: "bgm_world_vault", format: "mp3", loop: true },
  storm: { file: "bgm_world_storm", format: "mp3", loop: true },
  fault: { file: "bgm_world_fault", format: "mp3", loop: true },
  heart: { file: "bgm_world_heart", format: "mp3", loop: true },
  // 새벽의 광산 loop: gapless mp3 (loop 0–75 s); plays on the plain HTMLAudio loop like every other BGM.
  dawn: { file: "bgm_dawn_mine_loop_v1_loop", format: "mp3", loop: true },
  tutorial: {
    file: "bgm_tutorial_loop_v1",
    format: "mp3",
    loop: true,
    durationMs: 67_500,
    loopRegionSec: { start: 0, end: 67.5 },
  },
}

export const BGM_TRACK_IDS = Object.keys(BGM_TRACK_REGISTRY) as BgmTrackId[]

export function bgmTrackFileName(id: BgmTrackId): string {
  const def = BGM_TRACK_REGISTRY[id]
  return `${def.file}.${def.format}`
}

export function bgmTrackUrl(id: BgmTrackId): string {
  return BGM_PUBLIC_DIR + bgmTrackFileName(id)
}

export function bgmTrackLoops(id: BgmTrackId): boolean {
  return BGM_TRACK_REGISTRY[id].loop
}

export function bgmTrackLoopRegionSec(id: BgmTrackId): { start: number; end: number } | undefined {
  return BGM_TRACK_REGISTRY[id].loopRegionSec
}

/** Entrance -> mine loop crossfade (the brief asks for 4-6 s; the middle of that range). */
export const MINE_ENTER_CROSSFADE_MS = 5_000
/** The entrance track fades in this fast over the hub theme (the door-walk video starts at once). */
export const MINE_ENTER_FADE_IN_MS = 300

/**
 * The mine entrance track is the door-walk video's soundtrack (same audio, 10 s): the video plays
 * muted and this BGM bed carries the sound, so it can hand over to the mine loop.
 */
export const MINE_ENTER_BGM_CARRIES_AUDIO = true

/** The cinematic's own audio: follows the music mute, and is off when the BGM bed plays the same track. */
export function mineEntryVideoMuted(musicMuted: boolean): boolean {
  return musicMuted || MINE_ENTER_BGM_CARRIES_AUDIO
}

/** Which half of a two-part bed is playing: the one-shot lead-in or the loop it hands over to. */
export type BgmBedPhase = "intro" | "loop"

export type BgmBedAdvance =
  /** Switch to the loop when the intro element ends by itself. */
  | { readonly kind: "ended" }
  /** Switch to the loop this long after the intro started playing (a crossfade starts here). */
  | { readonly kind: "timer"; readonly afterMs: number }

export type BgmBedDef = {
  readonly intro: BgmTrackId
  readonly loop: BgmTrackId
  readonly advance: BgmBedAdvance
  /** Fade length while the intro plays (the move from the previous scene onto the bed). Default: BGM_FADE_MS. */
  readonly fadeInMs?: number
  /** Fade length of the intro -> loop hand-over (both tracks). Default: BGM_FADE_MS. */
  readonly handoverMs?: number
  /** Tracks restarted from 0 when the scene starts / stops. */
  readonly rewindOnEnter: readonly BgmTrackId[]
  readonly rewindOnLeave: readonly BgmTrackId[]
}

const MINE_ENTER_LOOP_AT_MS = (BGM_TRACK_REGISTRY.mineEnter.durationMs ?? 0) - MINE_ENTER_CROSSFADE_MS

/** Scenes that play a lead-in and then a loop. Everything else is a single track. */
export const BGM_BEDS: Partial<Record<BgmScene, BgmBedDef>> = {
  rebirth: {
    intro: "rebirthIntro",
    loop: "rebirthHq",
    advance: { kind: "ended" },
    handoverMs: 900,
    rewindOnEnter: ["rebirthIntro", "rebirthHq"],
    rewindOnLeave: ["rebirthIntro", "rebirthHq"],
  },
  mineEnter: {
    intro: "mineEnter",
    loop: "mine",
    advance: { kind: "timer", afterMs: MINE_ENTER_LOOP_AT_MS },
    fadeInMs: MINE_ENTER_FADE_IN_MS,
    handoverMs: MINE_ENTER_CROSSFADE_MS,
    // The loop is restarted when the hand-over begins, the entrance is never cut while it fades out.
    rewindOnEnter: ["mineEnter"],
    rewindOnLeave: [],
  },
}

export function bgmBed(scene: BgmScene): BgmBedDef | undefined {
  return BGM_BEDS[scene]
}
