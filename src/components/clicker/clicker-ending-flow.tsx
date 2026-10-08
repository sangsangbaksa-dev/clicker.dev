"use client"

import { useEffect, useRef, useState } from "react"
import { CLICKER_TRUE_ENDING_STEPS } from "@/data/clicker/ending"
import {
  BGM_FADE_IN_S,
  BGM_FADE_OUT_S,
  SFX_FADE_OUT_S,
  captionAt,
  captionCues,
  endingBgmOn,
  endingStages,
  newWatchdog,
  nextEndingStage,
  sfxSync,
  skipAllowed,
  stepWatchdog,
  type EndingStage,
  type EndingVideoId,
} from "@/application/clicker-ending"
import { ClickerEnding, type EndingSummary } from "@/components/clicker/clicker-ending"
import { ENDING_BGM_MASTER, ENDING_MEDIA, createEndingTrack, endingVideoSrc, readEndingVideoQuality, type EndingTrack } from "@/lib/clicker-ending-media"
import "./clicker-ending-flow.css"

type Props = {
  /** `live`: the real ending (completion seals the record). `replay`: watch again, nothing is saved. */
  mode: "live" | "replay"
  /** Effects mute (the ending SFX) and music settings (the ending score). */
  sfxMuted: boolean
  musicMuted: boolean
  musicVolume: number
  summary?: EndingSummary
  onComplete: () => void
}

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

/**
 * Ending sequence: guardian-death video, core-awaken video (captions + SFX on the video clock),
 * then the story cards with the ending score. All timing comes from the pure timeline module.
 */
export function ClickerEndingFlow({ mode, sfxMuted, musicMuted, musicVolume, summary, onComplete }: Props) {
  const [reduced] = useState(prefersReducedMotion)
  const [stage, setStage] = useState<EndingStage>(() => endingStages(reduced)[0])
  const advance = (from: EndingStage) => setStage((cur) => (cur === from ? (nextEndingStage(from, reduced) ?? cur) : cur))

  const bgm = useRef<EndingTrack | null>(null)
  const bgmOn = endingBgmOn(stage)
  const bgmLevel = musicMuted ? 0 : Math.min(1, Math.max(0, musicVolume)) * ENDING_BGM_MASTER
  const bgmLevelRef = useRef(bgmLevel)
  useEffect(() => {
    bgmLevelRef.current = bgmLevel
    bgm.current?.setLevel(bgmLevel)
  }, [bgmLevel])
  useEffect(() => {
    if (!bgmOn) return
    const track = createEndingTrack(ENDING_MEDIA.bgm)
    bgm.current = track
    track.setLevel(bgmLevelRef.current)
    track.startWhenAllowed(() => 0)
    track.fadeIn(BGM_FADE_IN_S)
    return () => {
      bgm.current = null
      track.fadeOutAndStop(BGM_FADE_OUT_S)
    }
  }, [bgmOn])

  if (stage === "cards") return <ClickerEnding summary={summary} replay={mode === "replay"} onComplete={onComplete} />
  return <EndingVideoStage key={stage} video={stage} sfxMuted={sfxMuted} onDone={() => advance(stage)} />
}

function EndingVideoStage({ video, sfxMuted, onDone }: { video: EndingVideoId; sfxMuted: boolean; onDone: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [videoSrc] = useState(() => endingVideoSrc(video, readEndingVideoQuality()))
  const captionRef = useRef<HTMLDivElement | null>(null)
  const sfxRef = useRef<EndingTrack | null>(null)
  const sfxMutedRef = useRef(sfxMuted)
  const startedAt = useRef(0)
  const doneRef = useRef(false)
  const onDoneRef = useRef(onDone)
  const [ready, setReady] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const skipRef = useRef<(viaKey?: { repeat: boolean }) => void>(() => {})
  const [cues] = useState(() => captionCues(CLICKER_TRUE_ENDING_STEPS, video))
  const active = CLICKER_TRUE_ENDING_STEPS.find((s) => s.id === activeId)

  useEffect(() => {
    onDoneRef.current = onDone
  }, [onDone])
  useEffect(() => {
    sfxMutedRef.current = sfxMuted
    sfxRef.current?.setLevel(sfxMuted ? 0 : 1)
  }, [sfxMuted])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    startedAt.current = performance.now()
    doneRef.current = false // React StrictMode re-runs effects
    const sfx = createEndingTrack(ENDING_MEDIA.sfx[video])
    sfx.setLevel(sfxMutedRef.current ? 0 : 1)
    sfxRef.current = sfx
    const clock = () => v.currentTime

    // Idempotent: ended, skip, key, error, watchdog may race.
    const finish = (fadeS: number) => {
      if (doneRef.current) return
      doneRef.current = true
      sfx.fadeOutAndStop(fadeS)
      onDoneRef.current()
    }
    const skip = (viaKey?: { repeat: boolean }) => {
      const elapsedS = (performance.now() - startedAt.current) / 1000
      if (skipAllowed({ stage: video, elapsedS, viaKey })) finish(SFX_FADE_OUT_S)
    }
    skipRef.current = skip

    // The video is silent and muted, so it always autoplays; SFX is slaved to its clock.
    v.muted = true
    void v.play().catch(() => finish(0))
    const onPlaying = () => {
      setReady(true)
      sfx.resume(clock)
    }
    const onHold = () => sfx.pause()
    v.addEventListener("playing", onPlaying)
    v.addEventListener("waiting", onHold)
    v.addEventListener("pause", onHold)
    const onVisibility = () => {
      if (document.hidden) {
        v.pause()
      } else if (!v.ended) void v.play().catch(() => finish(0))
    }
    document.addEventListener("visibilitychange", onVisibility)

    let raf = 0
    let shown: string | null = null
    const frame = () => {
      raf = window.requestAnimationFrame(frame)
      const t = v.currentTime
      const cap = captionAt(cues, t)
      if ((cap?.id ?? null) !== shown) {
        shown = cap?.id ?? null
        setActiveId(shown)
      }
      if (captionRef.current) captionRef.current.style.opacity = String(cap?.opacity ?? 0)
      if (sfx.isPlaying()) {
        const s = sfxSync(t, sfx.time(), video)
        if (s.stop) sfx.fadeOutAndStop(SFX_FADE_OUT_S)
        else if (s.seekTo !== null) sfx.seek(s.seekTo)
      }
    }
    raf = window.requestAnimationFrame(frame)

    let wd = newWatchdog()
    const tickMs = 250
    const timer = window.setInterval(() => {
      const r = stepWatchdog(wd, { dtS: tickMs / 1000, videoT: v.currentTime, hidden: document.hidden, ended: v.ended })
      wd = r.next
      if (r.expired) finish(SFX_FADE_OUT_S)
    }, tickMs)

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" && e.key !== "Enter" && e.key !== " ") return
      e.preventDefault()
      skip({ repeat: e.repeat })
    }
    window.addEventListener("keydown", onKey)
    const onEnded = () => finish(0)
    v.addEventListener("ended", onEnded)
    v.addEventListener("error", onEnded)

    return () => {
      window.cancelAnimationFrame(raf)
      window.clearInterval(timer)
      window.removeEventListener("keydown", onKey)
      document.removeEventListener("visibilitychange", onVisibility)
      v.removeEventListener("playing", onPlaying)
      v.removeEventListener("waiting", onHold)
      v.removeEventListener("pause", onHold)
      v.removeEventListener("ended", onEnded)
      v.removeEventListener("error", onEnded)
      doneRef.current = true
      sfx.fadeOutAndStop(SFX_FADE_OUT_S)
      sfxRef.current = null
    }
  }, [video, cues])

  return (
    <div
      className="clicker-ending-stage"
      role="dialog"
      aria-modal="true"
      aria-label="엔딩"
      style={{ backgroundImage: `url(${ENDING_MEDIA.poster[video]})` }}
    >
      <video
        ref={videoRef}
        className={`clicker-ending-video${ready ? " is-ready" : ""}`}
        src={videoSrc}
        poster={ENDING_MEDIA.poster[video]}
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
      />
      <div ref={captionRef} className="clicker-ending-caption" style={{ opacity: 0 }} aria-live="polite">
        {active ? (
          <>
            {active.accent ? <p>{active.accent}</p> : null}
            <h2>{active.title}</h2>
            <span>{active.body}</span>
          </>
        ) : null}
      </div>
      <button type="button" className="clicker-ending-skip" onClick={() => skipRef.current()}>
        건너뛰기 ▶▶
      </button>
    </div>
  )
}
