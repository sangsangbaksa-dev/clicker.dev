import type { CueId } from "@/domain/services/clicker-audio-cues"

/** Plays the file-based cues of clicker-audio-cues; implemented in infrastructure. */
export type ClickerCuePlayer = {
  /** One-shot (or restart of a one-shot). Silently ignored while muted, before the first gesture, or when the browser refuses. */
  play(id: CueId): void
  /** Loop cues: no-op if already running. */
  startLoop(id: CueId): void
  /** Fades out briefly, then pauses and rewinds. No-op if not running. */
  stopLoop(id: CueId): void
  /** SFX mute setting; muting silences everything that is playing. */
  setMuted(muted: boolean): void
  /** Stops every loop and one-shot (unmount, hidden tab). */
  stopAll(): void
}

const SILENT: ClickerCuePlayer = {
  play() {},
  startLoop() {},
  stopLoop() {},
  setMuted() {},
  stopAll() {},
}

let player: ClickerCuePlayer | null = null

export function bindClickerCuePlayer(p: ClickerCuePlayer): void {
  player = p
}

/** The bound player, or a silent one (server render, tests, adapter not loaded). */
export function clickerCues(): ClickerCuePlayer {
  return player ?? SILENT
}

/** Test-only. */
export function resetClickerCuePlayer(): void {
  player = null
}
