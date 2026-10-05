import type { BgmLoopTrack, ClickerBgmPorts } from "@/application/clicker-audio-ports"
import type { BgmTrackId } from "@/domain/services/clicker-bgm"
import {
  allBgmTrackIds,
  bgmTrackShouldLoop,
  CLICKER_BGM_URL,
  warmBgmTracks,
} from "@/infrastructure/audio/clicker-bgm-catalog"

export type HtmlClickerBgmPortDeps = {
  resumeSharedContext: () => void
  sharedAudioContext: () => AudioContext | null
}

type TrackRecord = {
  audio: HTMLAudioElement
  gain: GainNode | null
  playing: boolean
}

function wrapTrack(rec: TrackRecord): BgmLoopTrack {
  return {
    play() {
      if (!rec.audio.paused) return Promise.resolve()
      rec.playing = true
      return rec.audio.play().then(
        () => undefined,
        () => {
          rec.playing = false
        },
      )
    },
    pause() {
      rec.playing = false
      rec.audio.pause()
    },
    setOutputLevel(level: number) {
      if (rec.gain) rec.gain.gain.value = level
      else rec.audio.volume = level
    },
    onEnded(listener: () => void) {
      rec.audio.addEventListener("ended", listener)
    },
    rewind() {
      rec.audio.currentTime = 0
    },
    preload() {
      rec.audio.preload = "auto"
      rec.audio.load()
    },
  }
}

/** HTMLAudioElement-backed BGM port (no network until allowNetwork is true). */
export function createHtmlClickerBgmPorts(deps: HtmlClickerBgmPortDeps): ClickerBgmPorts {
  const records = new Map<BgmTrackId, TrackRecord>()

  const materialize = (id: BgmTrackId, allowNetwork: boolean): TrackRecord | null => {
    if (!allowNetwork) return null
    let rec = records.get(id)
    if (!rec) {
      const audio = new Audio()
      audio.loop = bgmTrackShouldLoop(id)
      audio.preload = "none"
      audio.volume = 0
      audio.src = CLICKER_BGM_URL[id]
      rec = { audio, gain: null, playing: false }
      records.set(id, rec)
    }
    return rec
  }

  return {
    allTrackIds: allBgmTrackIds,
    resumeSharedContext() {
      deps.resumeSharedContext()
    },
    acquireTrack(id, allowNetwork) {
      const rec = materialize(id, allowNetwork)
      return rec ? wrapTrack(rec) : null
    },
    warmTracks(ids, allowNetwork) {
      if (!allowNetwork) return
      warmBgmTracks(ids)
    },
    wireTrack(id, _track: BgmLoopTrack) {
      const rec = records.get(id)
      if (!rec || rec.gain) return
      const c = deps.sharedAudioContext()
      if (!c) return
      try {
        const node = c.createGain()
        node.gain.value = 0
        c.createMediaElementSource(rec.audio).connect(node)
        node.connect(c.destination)
        rec.audio.volume = 1
        rec.gain = node
      } catch {
        /* element volume fallback */
      }
    },
    hasGainNode(id) {
      return Boolean(records.get(id)?.gain)
    },
    dispose() {
      for (const rec of records.values()) {
        rec.audio.pause()
        rec.audio.removeAttribute("src")
        rec.audio.load()
      }
      records.clear()
    },
  }
}
