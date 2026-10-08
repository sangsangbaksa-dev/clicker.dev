import type { BgmScene, BgmTrackId } from "@/domain/services/clicker-bgm"
import type { CoreVisual } from "@/domain/services/clicker-view"

/** One looping BGM element the engine can fade and play. */
export type BgmLoopTrack = {
  play(): Promise<void>
  pause(): void
  setOutputLevel(level: number): void
  /** One-shot beds fire when natural playback ends. */
  onEnded?(listener: () => void): void
  rewind?(): void
  /** Start fetching without playing (a bed's loop is primed while its lead-in plays). */
  preload?(): void
}

export type BgmEngineState = {
  scene: BgmScene
  muted: boolean
  volume: number
  visual: CoreVisual | undefined
  hasUserGesture: boolean
}

/** Browser-facing audio primitives; implemented in infrastructure. */
export type ClickerBgmPorts = {
  allTrackIds(): BgmTrackId[]
  resumeSharedContext(): void
  /** Materialize a track only when allowNetwork is true; otherwise null. */
  acquireTrack(id: BgmTrackId, allowNetwork: boolean): BgmLoopTrack | null
  warmTracks(ids: BgmTrackId[], allowNetwork: boolean): void
  wireTrack(id: BgmTrackId, track: BgmLoopTrack): void
  hasGainNode(id: BgmTrackId): boolean
  dispose(): void
}
