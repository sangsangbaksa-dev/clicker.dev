import {
  bgmFadeStep,
  bgmMayTouchTrack,
  bgmOutputLevel,
  bgmPlayerGain,
  bgmTrackFadeTarget,
  bgmTracksToWarm,
  type BgmTrackId,
} from "@/domain/services/clicker-bgm"
import type { BgmEngineState, BgmLoopTrack, ClickerBgmPorts } from "@/application/clicker-audio-ports"

type Runtime = {
  tracks: Partial<Record<BgmTrackId, BgmLoopTrack>>
  levels: Record<BgmTrackId, number>
  playPending: Set<BgmTrackId>
  hidden: boolean
  raf: number
  last: number
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

  const step = (t: number) => {
    const dt = runtime.last ? t - runtime.last : 16
    runtime.last = t
    const playerGain = bgmPlayerGain(state.volume, state.muted, state.visual, runtime.hidden)
    const mayTouch = allowNetwork()
    let moving = false
    for (const key of ports.allTrackIds()) {
      const target = bgmTrackFadeTarget(key, state.scene, runtime.hidden, playerGain)
      let track = runtime.tracks[key]
      if (!track) {
        if (target === 0) continue
        if (!mayTouch) continue
        const acquired = ports.acquireTrack(key, true)
        if (!acquired) continue
        track = acquired
        runtime.tracks[key] = track
      }
      if (target > 0 && mayTouch) tryPlay(key, track)
      const nextLevel = bgmFadeStep(runtime.levels[key], target, dt)
      runtime.levels[key] = nextLevel
      track.setOutputLevel(bgmOutputLevel(nextLevel, playerGain, key))
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
      const sceneChanged = next.scene !== undefined && next.scene !== state.scene
      state = {
        ...state,
        ...next,
        hasUserGesture: next.hasUserGesture ?? state.hasUserGesture,
      }
      if (sceneChanged) {
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
