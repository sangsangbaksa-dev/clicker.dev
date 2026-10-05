"use client"

import { CINEMATIC_VARIANTS } from "@/data/clicker/cinematic-variants"
import {
  cinematicEndFadeMs,
  pickCinematicQuality,
  resolveCinematicMedia,
  type CinematicEndReason,
  type CinematicQuality,
  type ResolvedCinematic,
} from "@/domain/services/clicker-cinematic"

type ConnectionInfo = { saveData?: boolean; effectiveType?: string }

/** Reads viewport + connection hints and lets the pure rule choose the render (HQ on the server / when unknown). */
export function readCinematicQuality(): CinematicQuality {
  if (typeof window === "undefined") return "hq"
  const conn = (navigator as Navigator & { connection?: ConnectionInfo }).connection
  return pickCinematicQuality({ viewportWidth: window.innerWidth, saveData: conn?.saveData, effectiveType: conn?.effectiveType })
}

/** The file / poster / closing fade this device plays for `src` (registry in data, rules in domain). */
export function resolveCinematic(src: string, poster: string): ResolvedCinematic {
  return resolveCinematicMedia(src, poster, CINEMATIC_VARIANTS, readCinematicQuality())
}

export type { CinematicEndReason }

/** Closing cross-fade (ms) for this end reason, reading prefers-reduced-motion (never fades under it). */
export function readCinematicEndFadeMs(reason: CinematicEndReason, handoffMs: number): number {
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  return cinematicEndFadeMs(reason, handoffMs, reduced)
}
