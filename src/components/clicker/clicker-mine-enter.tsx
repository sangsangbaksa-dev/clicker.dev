"use client"

import { useEffect, useRef } from "react"
import { MineArt } from "@/data/clicker/mine-assets"

type Props = {
  muted: boolean
  onDone: () => void
}

/**
 * Door-walk v11 entry cinematic (closed door → split-open → walk-in).
 * Always completes the transition: ended, skip, Esc, load error, or a hard timeout.
 */
export function ClickerMineEnter({ muted, onDone }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const doneRef = useRef(false)
  const onDoneRef = useRef(onDone)

  useEffect(() => {
    onDoneRef.current = onDone
  }, [onDone])

  // Idempotent: ended, skip, Esc, error and the timeout may all race.
  const finishRef = useRef(() => {
    if (doneRef.current) return
    doneRef.current = true
    onDoneRef.current()
  })

  useEffect(() => {
    const finish = finishRef.current
    const video = videoRef.current
    if (video) {
      video.muted = muted
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
    // Safety net: never strand the player behind a stalled video.
    const timer = window.setTimeout(finish, 15_000)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.clearTimeout(timer)
    }
  }, [muted])

  const finish = () => finishRef.current()

  return (
    <div className="clicker-mine-enter" role="dialog" aria-label="광산 입장 중">
      <video
        ref={videoRef}
        className="clicker-mine-enter-video"
        src={MineArt.enterCinematic}
        poster={MineArt.entranceGate}
        playsInline
        preload="auto"
        onEnded={finish}
        onError={finish}
      />
      <button type="button" className="clicker-mine-enter-skip" onClick={finish}>
        건너뛰기 ▶▶
      </button>
    </div>
  )
}
