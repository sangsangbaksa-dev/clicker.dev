"use client"

import { useEffect, useRef, useState } from "react"
import { readCinematicEndFadeMs, resolveCinematic, type CinematicEndReason } from "@/lib/clicker-cinematic-quality"
import "./clicker-cinematic.css"

/** Warm cache: one detached <video preload="auto"> per src, so the real player starts at once. */
const warmed = new Map<string, HTMLVideoElement>()
export function preloadCinematic(requested: string) {
  if (typeof window === "undefined") return
  // Warm the resolved file (mine entry is a single 1080p render on all devices).
  const src = resolveCinematic(requested, "").src
  if (warmed.has(src)) return
  const v = document.createElement("video")
  v.preload = "auto"
  v.muted = true
  v.src = src
  v.load()
  warmed.set(src, v)
}

type Props = {
  src: string
  poster: string
  /** Accessible name of the dialog, e.g. "광산 입장 중". */
  label: string
  /** Optional title card over the video (region intros). */
  caption?: { kicker?: string; title: string; body: string }
  /** Follows the background-music settings: muted with the music, at the music volume (0..1). */
  muted: boolean
  volume?: number
  /**
   * Fires once, right before the closing fade starts (or together with `onDone` when there is no fade): put the next screen underneath here. */
  onReveal?: () => void
  onDone: () => void
}

/** Hard cap so a stalled video can never strand the player. */
const SAFETY_TIMEOUT_MS = 15_000

/**
 * Full-screen video with its own soundtrack (mine entry, first-visit region intros).
 * Always completes: ended, skip, Esc/Enter/Space, load error, or the safety timeout.
 */
export function ClickerCinematic({ src, poster, label, caption, muted, volume = 1, onReveal, onDone }: Props) {
  // One resolution per mount: file, poster and closing fade for this device (registry in data).
  const [media] = useState(() => resolveCinematic(src, poster))
  const handoffMs = media.handoffMs
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const doneRef = useRef(false)
  const revealedRef = useRef(false)
  const leavingRef = useRef(false)
  const leaveTimerRef = useRef<number | null>(null)
  const mutedAtStart = useRef(muted)
  const onDoneRef = useRef(onDone)
  const onRevealRef = useRef(onReveal)
  const handoffRef = useRef(handoffMs)
  /** The poster stays up until the first frame is ready, so there's no black flash. */
  const [ready, setReady] = useState(false)
  /** Closing cross-fade running: the last frame is held while the screen underneath shows through. */
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    onDoneRef.current = onDone
    onRevealRef.current = onReveal
  }, [onDone, onReveal])

  // Idempotent: ended, skip, keys, error and the timeout may all race.
  const finishRef = useRef((reason: CinematicEndReason) => {
    if (doneRef.current) return
    const reveal = () => {
      if (revealedRef.current) return
      revealedRef.current = true
      onRevealRef.current?.()
    }
    const fadeMs = leavingRef.current ? 0 : readCinematicEndFadeMs(reason, handoffRef.current)
    if (fadeMs > 0) {
      leavingRef.current = true
      reveal()
      setLeaving(true)
      leaveTimerRef.current = window.setTimeout(() => finishRef.current("timeout"), fadeMs)
      return
    }
    doneRef.current = true
    if (leaveTimerRef.current !== null) window.clearTimeout(leaveTimerRef.current)
    reveal()
    onDoneRef.current()
  })

  // Mute follows the setting live; it must not restart playback or the safety timer.
  useEffect(() => {
    if (!videoRef.current) return
    videoRef.current.muted = muted
    videoRef.current.volume = Math.min(1, Math.max(0, volume))
  }, [muted, volume])

  useEffect(() => {
    const finish = finishRef.current
    const video = videoRef.current
    if (video) {
      video.muted = mutedAtStart.current
      void video.play().catch(() => {
        // Autoplay with sound refused — retry silently, else skip the cinematic.
        video.muted = true
        void video.play().catch(() => finish("error"))
      })
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" && e.key !== "Enter" && e.key !== " ") return
      e.preventDefault()
      finish("skip")
    }
    window.addEventListener("keydown", onKey)
    const timer = window.setTimeout(() => finish("timeout"), SAFETY_TIMEOUT_MS)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.clearTimeout(timer)
      if (leaveTimerRef.current !== null) window.clearTimeout(leaveTimerRef.current)
    }
  }, [])

  const finish = (reason: CinematicEndReason) => finishRef.current(reason)

  return (
    <div
      className={`clicker-cinematic${leaving ? " is-leaving" : ""}`}
      role="dialog"
      aria-label={label}
      style={{ backgroundImage: `url(${media.poster})`, ...(leaving ? { transitionDuration: `${handoffMs}ms` } : null) }}
    >
      <video
        ref={videoRef}
        className={`clicker-cinematic-video${ready ? " is-ready" : ""}`}
        onPlaying={() => setReady(true)}
        src={media.src}
        poster={media.poster}
        playsInline
        preload="auto"
        onEnded={() => finish("ended")}
        onError={() => finish("error")}
      />
      {caption ? (
        <div className="clicker-cinematic-caption" aria-live="polite">
          {caption.kicker ? <p>{caption.kicker}</p> : null}
          <h2>{caption.title}</h2>
          <span>{caption.body}</span>
        </div>
      ) : null}
      <button type="button" className="clicker-cinematic-skip" onClick={() => finish("skip")}>
        건너뛰기 ▶▶
      </button>
    </div>
  )
}
