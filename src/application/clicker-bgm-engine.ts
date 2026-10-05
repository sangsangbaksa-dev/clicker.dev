import {
  bgmFadeStep,
  bgmMayTouchTrack,
  bgmOutputLevel,
  bgmPlayerGain,
  bgmTrackFadeTarget,
  bgmTracksToWarm,
  type BgmRebirthBedPhase,
  type BgmScene,
  type BgmTrackId,
} from "@/domain/services/clicker-bgm"
import type { CoreVisual } from "@/domain/services/clicker-view"

/** One looping BGM element the engine can fade and play. */
export type BgmLoopTrack = {
  play(): Promise<void>
  pause(): void
  setOutputLevel(level: number): void
  /** One-shot beds fire when natural playback ends. */
  onEnded?(listener: () => void): void
  rewind?(): void
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

type Runtime = {
  tracks: Partial<Record<BgmTrackId, BgmLoopTrack>>
  levels: Record<BgmTrackId, number>
  playPending: Set<BgmTrackId>
  hidden: boolean
  raf: number
  last: number
  rebirthBed: BgmRebirthBedPhase
  rebirthIntroHooked: boolean
}

export function createClickerBgmEngine(ports: ClickerBgmPorts) {
  const levels = Object.fromEntries(ports.allTrackIds().map((id) => [id, 0])) as Record<BgmTrackId, number>
  const runtime: Runtime = {
    tracks: {},
    levels,
    playPending: new Set(),
    hidden: typeof document !== "undefined" ? document.visibilityState === "hidden" : false,
    raf: 0,
    last: 0,
    rebirthBed: "intro",
    rebirthIntroHooked: false,
  }

  let state: BgmEngineState = {
    scene: "hub",
    muted: true,
    volume: 0,
    visual: undefined,
    hasUserGesture: false,
  }

  const allowNetwork = () => bgmMayTouchTrack(state.hasUserGesture, state.muted)

  const tryPlay = (key: BgmTrackId, track: BgmLoopTrack) => {
    if (!state.hasUserGesture || runtime.playPending.has(key)) return
    ports.wireTrack(key, track)
    runtime.playPending.add(key)
    void track.play().finally(() => {
      runtime.playPending.delete(key)
    })
  }

  const hookRebirthIntroEnded = (track: BgmLoopTrack) => {
    if (runtime.rebirthIntroHooked || !track.onEnded) return
    runtime.rebirthIntroHooked = true
    track.onEnded(() => {
      if (state.scene !== "rebirth") return
      runtime.rebirthBed = "loop"
      const loop = runtime.tracks.rebirthHq
      loop?.rewind?.()
      kick()
    })
  }

  const resetRebirthBed = () => {
    runtime.rebirthBed = "intro"
    runtime.tracks.rebirthIntro?.rewind?.()
    runtime.tracks.rebirthHq?.rewind?.()
  }

  const step = (t: number) => {
    const dt = runtime.last ? t - runtime.last : 16
    runtime.last = t
    const playerGain = bgmPlayerGain(state.volume, state.muted, state.visual, runtime.hidden)
    const mayTouch = allowNetwork()
    let moving = false
    for (const key of ports.allTrackIds()) {
      const target = bgmTrackFadeTarget(key, state.scene, runtime.hidden, playerGain, runtime.rebirthBed)
      let track = runtime.tracks[key]
      if (!track) {
        if (target === 0) continue
        if (!mayTouch) continue
        const acquired = ports.acquireTrack(key, true)
        if (!acquired) continue
        track = acquired
        runtime.tracks[key] = track
        if (key === "rebirthIntro") hookRebirthIntroEnded(track)
      }
      if (target > 0 && mayTouch) tryPlay(key, track)
      const nextLevel = bgmFadeStep(runtime.levels[key], target, dt)
      runtime.levels[key] = nextLevel
      track.setOutputLevel(bgmOutputLevel(nextLevel, playerGain))
      if (nextLevel === 0) track.pause()
      if (nextLevel !== target) moving = true
    }
    runtime.raf = moving ? window.requestAnimationFrame(step) : 0
    if (!moving) runtime.last = 0
  }

  const kick = () => {
    if (!runtime.raf) runtime.raf = window.requestAnimationFrame(step)
  }

  const warmForScene = () => {
    ports.warmTracks(bgmTracksToWarm(state.scene), allowNetwork())
  }

  return {
    setState(next: Omit<BgmEngineState, "hasUserGesture"> & { hasUserGesture?: boolean }) {
      const prevScene = state.scene
      const sceneChanged = next.scene !== undefined && next.scene !== state.scene
      state = {
        ...state,
        ...next,
        hasUserGesture: next.hasUserGesture ?? state.hasUserGesture,
      }
      if (sceneChanged) {
        if (prevScene === "rebirth") resetRebirthBed()
        if (state.scene === "rebirth") {
          resetRebirthBed()
          const intro = runtime.tracks.rebirthIntro
          if (intro) hookRebirthIntroEnded(intro)
        }
        warmForScene()
      }
      kick()
    },
    onUserGesture() {
      state = { ...state, hasUserGesture: true }
      ports.resumeSharedContext()
      warmForScene()
      kick()
    },
    onVisibility(hidden: boolean) {
      runtime.hidden = hidden
      if (hidden) {
        for (const key of ports.allTrackIds()) {
          runtime.levels[key] = 0
          const track = runtime.tracks[key]
          if (track) {
            track.setOutputLevel(0)
            track.pause()
          }
        }
      } else {
        ports.resumeSharedContext()
        for (const key of ports.allTrackIds()) {
          const track = runtime.tracks[key]
          if (track && ports.hasGainNode(key)) tryPlay(key, track)
        }
      }
      kick()
    },
    dispose() {
      if (runtime.raf) window.cancelAnimationFrame(runtime.raf)
      for (const track of Object.values(runtime.tracks)) track.pause()
      runtime.tracks = {}
      ports.dispose()
    },
  }
}

let bgmPortFactory: (() => ClickerBgmPorts) | null = null

export function bindClickerBgmPortFactory(create: () => ClickerBgmPorts): void {
  bgmPortFactory = create
}

export function clickerBgmPorts(): ClickerBgmPorts {
  if (!bgmPortFactory) throw new Error("Clicker BGM ports are not bound")
  return bgmPortFactory()
}

/** Test-only: clear bindings. */
export function resetClickerBgmBindings(): void {
  bgmPortFactory = null
}
