"use client"

import { useEffect, useRef, useState } from "react"
import "./clicker-cinematic.css"

type Props = {
  src: string
  /** Accessible name of the dialog, e.g. "광산 입장 중". */
  label: string
  /** Optional title card over the video (region intros). */
  caption?: { kicker: string; title: string; body: string }
  /** When the caption fades in (default 1.2 s); it stays until the video ends. */
  captionAtSec?: number
  muted: boolean
  onDone: () => void
}

/** Hard cap so a stalled video can never strand the player. */
const SAFETY_TIMEOUT_MS = 15_000

/**
 * Full-screen video with its own soundtrack (mine entry, first-visit region intros).
 * Always completes: ended, skip, Esc/Enter/Space, load error, or the safety timeout.
 */
export function ClickerCinematic({ src, label, caption, captionAtSec, muted, onDone }: Props) {
  // Black until the first frame actually plays: a poster image would flash a still before the video.
  const [playing, setPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const doneRef = useRef(false)
  const mutedAtStart = useRef(muted)
  const onDoneRef = useRef(onDone)

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
    if (videoRef.current) videoRef.current.muted = muted
  }, [muted])

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

  return (
    <div className="clicker-cinematic" role="dialog" aria-label={label}>
      <video
        ref={videoRef}
        className={`clicker-cinematic-video${playing ? " is-playing" : ""}`}
        src={src}
        playsInline
        preload="auto"
        onPlaying={() => setPlaying(true)}
        onEnded={finish}
        onError={finish}
      />
      {caption ? (
        <div
          className="clicker-cinematic-caption"
          aria-live="polite"
          style={captionAtSec === undefined ? undefined : { animationDelay: `${captionAtSec}s`, animationDuration: "4.5s" }}
        >
          <p>{caption.kicker}</p>
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
