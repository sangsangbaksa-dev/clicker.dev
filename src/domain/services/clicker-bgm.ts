import type { CoreVisual } from "./clicker-view.ts"

/** Logical BGM scenes the runtime crossfades between. */
export type BgmTrackId =
  | "hub"
  | "mine"
  | "chamber"
  | "relay"
  | "vault"
  | "storm"
  | "fault"
  | "heart"

export type BgmScene = BgmTrackId | "silent"

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
): number {
  if (tabHidden || playerGain <= 0 || scene === "silent") return 0
  return scene === track ? 1 : 0
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
  enteringMine: boolean
  regionIntro: unknown
  endingPhase: unknown
  pendingRebirth: boolean
  endingOpen: boolean
  playSurface: "hub" | "mine" | string
  currentRegionId: string | undefined
}

/** Cinematics silence the score; rebirth/ending use the chamber bed. */
export function resolveBgmScene(overlay: BgmOverlayState): BgmScene {
  if (overlay.enteringMine || overlay.regionIntro || overlay.endingPhase) return "silent"
  if (overlay.pendingRebirth || overlay.endingOpen) return "chamber"
  if (overlay.playSurface === "mine") return "mine"
  return worldBgmTrack(overlay.currentRegionId)
}
