/**
 * Region core-drill entry cinematics (1080p). Videos ship separately; paths follow this convention.
 * @see `clickerDrillEngageMedia` in application layer.
 */

export const DRILL_ENTER_CINEMATIC_WIDTH = 1920
export const DRILL_ENTER_CINEMATIC_HEIGHT = 1080
export const DRILL_ENTER_POSTER_WIDTH = 1920
export const DRILL_ENTER_POSTER_HEIGHT = 1080

/** Default engage clip when a region omits `intro.engageVideo`. */
export function drillEnterVideoSrc(regionId: string): string {
  return `/clicker/drill/drill_enter_${regionId}_1080p.mp4`
}

/** Optional poster (frame 0); falls back to the region still in the resolver. */
export function drillEnterPosterSrc(regionId: string): string {
  return `/clicker/drill/drill_enter_${regionId}_poster.webp`
}
