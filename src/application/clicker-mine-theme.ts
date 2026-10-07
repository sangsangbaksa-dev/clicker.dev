import type { MetaState } from "@/domain/entities/clicker"
import {
  activeMineWorldlineThemeId,
  mineWorldlineTheme,
  mineWorldlineThemeCssVars,
  type MineWorldlineTheme,
  type MineWorldlineThemeId,
} from "@/domain/services/clicker-mine-worldline-theme"
import { mineEntranceGate, mineEnterPoster, MINE_ENTER_VIDEO, MineArt } from "@/data/clicker/mine-assets"

export type { MineWorldlineTheme, MineWorldlineThemeId } from "@/domain/services/clicker-mine-worldline-theme"

export type ClickerMineEntranceMedia = {
  themeId: MineWorldlineThemeId
  theme: MineWorldlineTheme
  entranceGate: string
  titleGate: string
  enterPoster: string
  enterCinematic: string
  cssVars: Record<string, string>
}

export function clickerMineEntranceMedia(meta: MetaState | undefined): ClickerMineEntranceMedia {
  const themeId = meta ? activeMineWorldlineThemeId(meta) : "origin"
  const theme = mineWorldlineTheme(themeId)
  return {
    themeId,
    theme,
    entranceGate: theme.entranceGateAsset ?? mineEntranceGate(themeId),
    titleGate: MineArt.titleGate,
    enterPoster: theme.enterPosterAsset ?? mineEnterPoster(themeId),
    enterCinematic: MINE_ENTER_VIDEO.src,
    cssVars: mineWorldlineThemeCssVars(theme),
  }
}
