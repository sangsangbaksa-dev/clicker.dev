import type { CinematicVariant } from "../../domain/services/clicker-cinematic.ts"
import { MINE_ENTER_HANDOFF_MS, MINE_ENTER_POSTER, MINE_ENTER_VIDEO } from "./mine-assets.ts"

/**
 * Per-src overrides for full-screen cinematics (poster + handoff fade).
 * Mine entry uses a single 1080p file on all devices.
 */
export const CINEMATIC_VARIANTS: Readonly<Record<string, CinematicVariant>> = {
  [MINE_ENTER_VIDEO.src]: {
    poster: MINE_ENTER_POSTER,
    handoffMs: MINE_ENTER_HANDOFF_MS,
  },
}
