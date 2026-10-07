import type { ClickerSettings } from "@/domain/entities/clicker"
import { DEFAULT_MUSIC_VOLUME } from "@/domain/services/clicker-engine"
import { resolveBgmScene, type BgmOverlayState, type BgmScene } from "@/domain/services/clicker-bgm"

export type { BgmScene } from "@/domain/services/clicker-bgm"
export { worldBgmTrack as worldBgm, REBIRTH_BGM_TAIL_MS } from "@/domain/services/clicker-bgm"
export { mineEntryVideoMuted } from "@/domain/services/clicker-bgm-tracks"
import type { CoreVisual } from "@/domain/services/clicker-view"

export function clickerBgmScene(overlay: BgmOverlayState): BgmScene {
  return resolveBgmScene(overlay)
}

export function clickerBgmControls(
  settings: ClickerSettings | undefined,
  otherTabActive: boolean,
  coreVisual: CoreVisual | undefined,
): { muted: boolean; volume: number; visual: CoreVisual | undefined } {
  return {
    muted: otherTabActive || (settings?.musicMuted ?? false),
    volume: settings?.musicVolume ?? DEFAULT_MUSIC_VOLUME,
    visual: coreVisual,
  }
}
