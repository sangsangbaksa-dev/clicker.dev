import type { ClickerSettings } from "@/domain/entities/clicker"
import { DEFAULT_MUSIC_VOLUME } from "@/domain/services/clicker-engine"
import { resolveBgmScene, type BgmOverlayState, type BgmScene } from "@/domain/services/clicker-bgm"
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
