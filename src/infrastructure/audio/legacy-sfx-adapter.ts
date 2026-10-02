import { GAME_SFX_EVENTS, GAME_SFX_LOOPS, type ClickerSfxPort, type GameSfxEvent, type GameSfxLoop } from "@/application/clicker-sfx-events"
import { playLaser, playSample, startLoopSample, stopLoopSample, warmSamples } from "@/lib/clicker-sfx"
import {
  DEFAULT_LEGACY_SFX_GAIN,
  LEGACY_SFX_GAIN,
  LEGACY_SFX_MIN_GAP,
  legacyLoopUrl,
  legacySfxUrl,
  SFX_PRIORITY_URLS,
} from "@/infrastructure/audio/legacy-sfx-catalog"

/** Web Audio adapter for the legacy-0929 effect files. A missing file just returns false (caller falls back). */
export function createLegacySfxPort(): ClickerSfxPort {
  const running = new Set<GameSfxLoop>()
  const play = (event: GameSfxEvent, gainScale = 1) =>
    playSample(
      legacySfxUrl(event),
      `legacy:${event}`,
      (LEGACY_SFX_GAIN[event] ?? DEFAULT_LEGACY_SFX_GAIN) * gainScale,
      LEGACY_SFX_MIN_GAP[event] ?? 30,
    )
  return {
    play: (event) => play(event),
    strike(muted, critical) {
      // sfx_click.ogg / sfx_click_crit.ogg (or the synth until decoded), with the thump on top.
      playLaser(muted, critical)
      if (!muted) play(critical ? "coreHitHeavy" : "coreHit")
    },
    warm() {
      warmSamples([...GAME_SFX_EVENTS.map(legacySfxUrl), ...GAME_SFX_LOOPS.map(legacyLoopUrl)], SFX_PRIORITY_URLS)
    },
    syncLoops(active) {
      const want = new Set(active)
      for (const loop of GAME_SFX_LOOPS) {
        if (want.has(loop)) {
          running.add(loop)
          startLoopSample(`loop:${loop}`, legacyLoopUrl(loop)) // gain 1: the file is already quiet
        } else if (running.delete(loop)) {
          stopLoopSample(`loop:${loop}`)
        }
      }
    },
  }
}
