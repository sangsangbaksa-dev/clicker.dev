"use client"

import { useEffect, useRef } from "react"
import { frameState, frameTransform, startLoop } from "@/application/clicker-ui"
import "./clicker-monster-view.css"

type Props = {
  src: string
  /** Bump to play the hit recoil (any change after mount). */
  hitKey?: number
  className?: string
}

const HIT_MS = 250

/**
 * Painted monster (1920x1080 key art) cover-fitted into its box with a code-driven idle breath
 * and hit recoil (no frame art). The box size, not the window, is the viewport, so the picture
 * fills the stage with no letterbox on any screen.
 */
export function MonsterView({ src, hitKey = 0, className }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const img = useRef<HTMLImageElement>(null)
  const hitAt = useRef<number | null>(null)
  const firstKey = useRef(hitKey)

  useEffect(() => {
    if (hitKey !== firstKey.current) hitAt.current = performance.now()
  }, [hitKey])

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
    return startLoop((t) => {
      const b = box.current
      const el = img.current
      if (!b || !el || !el.naturalWidth) return
      let p: number | null = null
      if (hitAt.current !== null) {
        const k = (performance.now() - hitAt.current) / HIT_MS
        if (k >= 1) hitAt.current = null
        else p = k
      }
      const f = frameState(
        { w: el.naturalWidth, h: el.naturalHeight },
        { w: b.clientWidth, h: b.clientHeight },
        t,
        p,
        reduced,
      )
      el.style.transform = frameTransform(f)
    })
  }, [])

  return (
    <div ref={box} className={`clicker-monster-view${className ? ` ${className}` : ""}`} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={img} src={src} alt="" draggable={false} />
    </div>
  )
}
