"use client"

import { useEffect, useRef, useState } from "react"
import { warmImage } from "@/components/clicker/clicker-preload"
import "./clicker-cinematic.css"

/** Warm cache: one detached <video preload="auto"> per src, so the real player starts at once. */
const warmed = new Map<string, HTMLVideoElement>()
export function preloadCinematic(src: string) {
  if (typeof window === "undefined" || warmed.has(src)) return
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
  onDone: () => void
}

/** Hard cap so a stalled video can never strand the player. */
const SAFETY_TIMEOUT_MS = 15_000

/**
 * Full-screen video with its own soundtrack (mine entry, first-visit region intros).
 * Always completes: ended, skip, Esc/Enter/Space, load error, or the safety timeout.
 */
export function ClickerCinematic({ src, poster, label, caption, muted, volume = 1, onDone }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const doneRef = useRef(false)
  const mutedAtStart = useRef(muted)
  const onDoneRef = useRef(onDone)
  /** True once decoded frames are painting — keeps the stage visible until motion starts (no poster flash). */
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(false)
    void warmImage(poster)
  }, [src, poster])

  useEffect(() => {
    onDoneRef.current = onDone
  }, [onDone])

  // Idempotent: ended, skip, keys, error and the timeout may all race.
  const finishRef = useRef(() => {
    if (doneRef.current) return
    doneRef.current = true
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
        void video.play().catch(finish)
      })
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" && e.key !== "Enter" && e.key !== " ") return
      e.preventDefault()
      finish()
    }
    window.addEventListener("keydown", onKey)
    const timer = window.setTimeout(finish, SAFETY_TIMEOUT_MS)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.clearTimeout(timer)
    }
  }, [])

  const finish = () => finishRef.current()

  const markReady = () => {
    const video = videoRef.current
    if (!video) {
      setReady(true)
      return
    }
    if (typeof video.requestVideoFrameCallback === "function") {
      video.requestVideoFrameCallback(() => setReady(true))
      return
    }
    setReady(true)
  }

  return (
    <div className={`clicker-cinematic${ready ? " is-ready" : ""}`} role="dialog" aria-label={label}>
      <video
        ref={videoRef}
        className="clicker-cinematic-video"
        onPlaying={markReady}
        src={src}
        playsInline
        preload="auto"
        onEnded={finish}
        onError={finish}
      />
      {caption ? (
        <div className="clicker-cinematic-caption" aria-live="polite">
          {caption.kicker ? <p>{caption.kicker}</p> : null}
          <h2>{caption.title}</h2>
          <span>{caption.body}</span>
        </div>
      ) : null}
      <button type="button" className="clicker-cinematic-skip" onClick={finish}>
        건너뛰기 ▶▶
      </button>
    </div>
  )
}
