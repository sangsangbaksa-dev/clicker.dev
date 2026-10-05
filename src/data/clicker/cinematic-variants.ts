import type { CinematicVariant } from "../../domain/services/clicker-cinematic.ts"
import { MINE_ENTER_HANDOFF_MS, MINE_ENTER_POSTER, MINE_ENTER_VIDEOS } from "./mine-assets.ts"

/**
 * Per-cinematic extras, keyed by the HQ src the app passes to `ClickerCinematic`.
 * Adding a 720p twin / own-first-frame poster / closing fade for another cinematic is one entry here.
 */
export const CINEMATIC_VARIANTS: Readonly<Record<string, CinematicVariant>> = {
  [MINE_ENTER_VIDEOS.hq.src]: {
    mobile720: MINE_ENTER_VIDEOS.mobile720.src,
    poster: MINE_ENTER_POSTER,
    handoffMs: MINE_ENTER_HANDOFF_MS,
  },
}
