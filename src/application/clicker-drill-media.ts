import type { RegionDef } from "@/domain/entities/clicker"
import { drillEnterPosterSrc, drillEnterVideoSrc } from "@/data/clicker/drill-assets"

export type ClickerDrillEngageMedia = {
  video: string
  poster: string
  label: string
}

/** Entry cinematic for a region's core-drill station (same role as mine `enterCinematic`). */
export function clickerDrillEngageMedia(region: RegionDef | undefined): ClickerDrillEngageMedia | null {
  if (!region || region.isHome || region.boss || region.huntMode) return null
  const intro = region.intro
  if (!intro) return null
  return {
    video: intro.engageVideo ?? drillEnterVideoSrc(region.id),
    poster: intro.still ?? intro.poster ?? drillEnterPosterSrc(region.id),
    label: `${region.name} · 시추 갱으로 내려가는 중`,
  }
}

/** Hunt or drill entry clip when leaving a region's still screen. */
export function clickerRegionEngageMedia(region: RegionDef | undefined): ClickerDrillEngageMedia | null {
  if (!region) return null
  if (region.huntMode && region.intro?.engageVideo) {
    return {
      video: region.intro.engageVideo,
      poster: region.intro.still ?? region.intro.poster,
      label: `${region.name} · 보스의 둥지로 들어가는 중`,
    }
  }
  return clickerDrillEngageMedia(region)
}
