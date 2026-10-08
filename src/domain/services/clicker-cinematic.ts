/** Pure rules for full-screen cinematics (mine entry): which render to play and how the last frame hands off. */

/** 1080p HQ cut or the 1280x720 mobile cut (same length, same soundtrack). */
export type CinematicQuality = "hq" | "mobile720"

/** Viewports at most this wide (CSS px: phones, small tablets in portrait) get the 720p cut. */
export const CINEMATIC_NARROW_VIEWPORT_PX = 820
const SLOW_CONNECTIONS: readonly string[] = ["slow-2g", "2g", "3g"]

export type CinematicMediaHint = {
  viewportWidth: number
  /** navigator.connection.saveData */
  saveData?: boolean
  /** navigator.connection.effectiveType */
  effectiveType?: string
}

/** Narrow viewport, data-saver or a slow connection -> 720p; anything unknown stays HQ. */
export function pickCinematicQuality(hint: CinematicMediaHint): CinematicQuality {
  if (hint.saveData === true) return "mobile720"
  if (hint.effectiveType && SLOW_CONNECTIONS.includes(hint.effectiveType)) return "mobile720"
  if (Number.isFinite(hint.viewportWidth) && hint.viewportWidth > 0 && hint.viewportWidth <= CINEMATIC_NARROW_VIEWPORT_PX) return "mobile720"
  return "hq"
}

/** Optional per-cinematic extras, keyed by the HQ video src in a data registry. */
export type CinematicVariant = {
  /** 1280x720 twin for phones / data-saver (same length, same soundtrack). */
  mobile720?: string
  /** Poster that is exactly the video's first frame (overrides the caller's poster). */
  poster?: string
  /** Cross-fade (ms) from the held last frame into the screen underneath after a natural end. */
  handoffMs?: number
}

export type ResolvedCinematic = { src: string; poster: string; handoffMs: number }

/** Which file, poster and closing fade a cinematic uses on this device; unregistered srcs pass through unchanged. */
export function resolveCinematicMedia(
  src: string,
  poster: string,
  variants: Readonly<Record<string, CinematicVariant>>,
  quality: CinematicQuality,
): ResolvedCinematic {
  const v = variants[src]
  if (!v) return { src, poster, handoffMs: 0 }
  return {
    src: quality === "mobile720" && v.mobile720 ? v.mobile720 : src,
    poster: v.poster ?? poster,
    handoffMs: v.handoffMs ?? 0,
  }
}

/** Why a cinematic is over: it played out, or the player / a failure cut it short. */
export type CinematicEndReason = "ended" | "skip" | "error" | "timeout"

/**
 * Milliseconds to cross-fade from the held last frame into the screen underneath.
 * Only a natural end fades; skip / error / timeout and reduced-motion hand off at once.
 */
export function cinematicEndFadeMs(reason: CinematicEndReason, handoffMs: number, reducedMotion: boolean): number {
  if (reason !== "ended" || reducedMotion) return 0
  if (!Number.isFinite(handoffMs) || handoffMs <= 0) return 0
  return Math.min(Math.round(handoffMs), MAX_HANDOFF_MS)
}

/** Upper bound so a bad registry value can never hold the player on a dead overlay. */
export const MAX_HANDOFF_MS = 2000
