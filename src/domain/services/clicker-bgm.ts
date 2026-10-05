import { bgmBed, type BgmBedPhase } from "./clicker-bgm-tracks.ts"
import type { CoreVisual } from "./clicker-view.ts"

/** Logical BGM scenes the runtime crossfades between. */
export type BgmTrackId =
  | "loading"
  | "hub"
  | "mine"
  | "mineEnter"
  | "chamber"
  | "rebirthIntro"
  | "rebirthHq"
  | "boss"
  | "relay"
  | "vault"
  | "storm"
  | "fault"
  | "heart"

/**
 * `rebirth` plays HQ intro once, then crossfades to the `rebirthHq` loop; `mineEnter` plays the
 * 10 s entrance track and crossfades (4-6 s) into the `mine` loop. See BGM_BEDS.
 */
export type BgmScene = BgmTrackId | "silent" | "rebirth"

/** Kept for existing callers: the two-part bed phase is shared by rebirth and the mine entrance. */
export type BgmRebirthBedPhase = BgmBedPhase

const WORLD_TRACK: Record<string, BgmTrackId> = {
  signal_relay: "relay",
  phase_vault: "vault",
  storm_spire: "storm",
  deep_fault: "fault",
  core_heart: "heart",
}

/** Hub theme for a region id; starting chamber uses the hub loop. */
export function worldBgmTrack(regionId: string | undefined): BgmTrackId {
  return (regionId && WORLD_TRACK[regionId]) || "hub"
}

/** Score sits under SFX; applied after the player's volume slider. */
export const BGM_MASTER_LEVEL = 0.5

/** Crossfade duration when switching scenes or ducking. */
export const BGM_FADE_MS = 900

const VISUAL_GAIN: Partial<Record<CoreVisual, number>> = { fever: 1.2, crisis: 0.75 }

/** Player-facing gain before master level (0 when muted or tab hidden). */
export function bgmPlayerGain(
  volume: number,
  muted: boolean,
  visual: CoreVisual | undefined,
  tabHidden: boolean,
): number {
  if (muted || tabHidden || volume <= 0) return 0
  const mood = visual ? (VISUAL_GAIN[visual] ?? 1) : 1
  return volume * mood
}

/** Per-track fade target: 1 only for the active scene while master gain is up. */
export function bgmTrackFadeTarget(
  track: BgmTrackId,
  scene: BgmScene,
  tabHidden: boolean,
  playerGain: number,
  bedPhase: BgmBedPhase = "intro",
): number {
  if (tabHidden || playerGain <= 0 || scene === "silent") return 0
  const bed = bgmBed(scene)
  if (bed) return track === bed[bedPhase] ? 1 : 0
  return scene === track ? 1 : 0
}

/**
 * Fade length for the current scene: the mine entrance eases in fast over the hub theme, then
 * crossfades into the mine loop over MINE_ENTER_CROSSFADE_MS; everything else uses BGM_FADE_MS.
 */
export function bgmFadeMsFor(scene: BgmScene, bedPhase: BgmBedPhase): number {
  const bed = bgmBed(scene)
  if (bed && bedPhase === "intro" && bed.fadeInMs !== undefined) return bed.fadeInMs
  if (bed && bedPhase === "loop" && bed.handoverMs !== undefined) return bed.handoverMs
  return BGM_FADE_MS
}

/** One rAF step toward the fade target (linear in time). */
export function bgmFadeStep(current: number, target: number, dtMs: number, fadeMs = BGM_FADE_MS): number {
  if (current === target) return current
  const delta = dtMs / fadeMs
  return target > current ? Math.min(target, current + delta) : Math.max(target, current - delta)
}

/** Element / gain-node level for a track at a given fade position. */
export function bgmOutputLevel(fade: number, playerGain: number): number {
  return Math.min(1, fade * playerGain) * BGM_MASTER_LEVEL
}

export type BgmOverlayState = {
  /** Save still loading (boot screen). */
  bootLoading?: boolean
  enteringMine: boolean
  regionIntro: unknown
  endingPhase: unknown
  pendingRebirth: boolean
  endingOpen: boolean
  playSurface: "hub" | "mine" | string
  currentRegionId: string | undefined
  /** Core guardian (or other region boss) fight in progress. */
  bossFight?: boolean
  /** The final guardian fight is running: plays the boss loop (silent scenes and the chamber still win). */
  finalBossFight?: boolean
}

/**
 * Whether the runtime may create or fetch BGM media (no mp3 until the first pointer/key
 * gesture, and never while background music is muted in settings).
 */
export function bgmMayTouchTrack(hasUserGesture: boolean, musicMuted: boolean): boolean {
  return hasUserGesture && !musicMuted
}

/** Scene preload is allowed under the same policy (silent scenes need no fetch). */
export function bgmTracksToWarm(scene: BgmScene): BgmTrackId[] {
  if (scene === "silent") return []
  const bed = bgmBed(scene)
  if (bed) return [bed.intro, bed.loop]
  return scene === "rebirth" ? [] : [scene]
}

/**
 * Cinematics, the ending and the boot screen silence the score; the mine door-walk plays the
 * entrance track (`mineEnter`, then the mine loop); rebirth and the ending's chamber cue play the
 * chamber track; the final guardian fight (`finalBossFight`) plays the boss loop; other boss fights
 * keep the world theme. Silence always wins, so the ending (and cinematics) mute the boss loop and
 * the mine entrance too.
 */
export function resolveBgmScene(overlay: BgmOverlayState): BgmScene {
  if (overlay.regionIntro || overlay.endingPhase) return "silent"
  if (overlay.bootLoading) return "silent"
  if (overlay.enteringMine) return "mineEnter"
  if (overlay.pendingRebirth || overlay.endingOpen) return "chamber"
  if (overlay.finalBossFight) return "boss"
  if (overlay.playSurface === "mine") return "mine"
  return worldBgmTrack(overlay.currentRegionId)
}
