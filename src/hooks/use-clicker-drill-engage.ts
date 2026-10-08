"use client"

import { useMemo } from "react"
import type { RegionDef } from "@/domain/entities/clicker"
import { clickerDrillEngageMedia, type ClickerDrillEngageMedia } from "@/application/clicker-drill-media"

/** Resolves drill-entry cinematic paths for the active region (preload + `ClickerCinematic`). */
export function useClickerDrillEngage(region: RegionDef | undefined): ClickerDrillEngageMedia | null {
  return useMemo(() => clickerDrillEngageMedia(region), [region])
}
