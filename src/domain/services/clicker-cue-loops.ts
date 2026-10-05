import { CUE_REGISTRY, type CueId } from "./clicker-audio-cues.ts"

/*
 * Which looping cues the game currently WANTS running (the breath bed during a fight, the drill hum
 * while tapping), independent of whether sound is possible right now. Muting SFX or hiding the tab
 * silences the loops; this memory lets the adapter bring back exactly the ones that are still wanted
 * once sound is possible again (instead of staying silent until the next fight / tap).
 * Pure: the adapter owns the HTMLAudioElements.
 */
export type LoopWishes = ReadonlySet<CueId>

export const NO_LOOP_WISHES: LoopWishes = new Set<CueId>()

/** The game asks for a loop (ignored for one-shot cues). */
export function wishLoop(wishes: LoopWishes, id: CueId): LoopWishes {
  if (!CUE_REGISTRY[id].loop || wishes.has(id)) return wishes
  return new Set([...wishes, id])
}

/** The game no longer wants the loop (works while muted too). */
export function dropLoop(wishes: LoopWishes, id: CueId): LoopWishes {
  if (!wishes.has(id)) return wishes
  const next = new Set(wishes)
  next.delete(id)
  return next
}

/** Loops to (re)start now: everything wanted, once sound is possible; nothing while it is not. */
export function loopsToRestart(wishes: LoopWishes, soundPossible: boolean): CueId[] {
  return soundPossible ? [...wishes] : []
}
