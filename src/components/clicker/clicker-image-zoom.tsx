"use client"

import { useEffect, useRef, useState } from "react"
import { useClickerDialogFocus } from "@/components/clicker/clicker-a11y"

/**
 * Tap any `img.clicker-zoomable` to see it large. Listens in the capture phase so the
 * tap opens the preview instead of also buying/selecting the card the image sits in.
 */
export function ClickerImageZoom() {
  const [src, setSrc] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  useClickerDialogFocus(rootRef, src !== null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = e.target
      if (!(el instanceof HTMLImageElement) || !el.classList.contains("clicker-zoomable")) return
      e.preventDefault()
      e.stopPropagation()
      setSrc(el.currentSrc || el.src)
    }
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [])

  useEffect(() => {
    if (!src) return
    // Capture + stop: Esc closes only the preview, not the settings/dialog underneath it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.preventDefault()
      e.stopPropagation()
      setSrc(null)
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [src])

  if (!src) return null
  return (
    <div ref={rootRef} className="clicker-zoom" role="dialog" aria-modal="true" aria-label="이미지 크게 보기" onClick={() => setSrc(null)}>
      <button
        type="button"
        className="clicker-ghost"
        style={{ position: "absolute", top: 12, right: 12 }}
        aria-label="닫기"
        aria-keyshortcuts="Escape"
        onClick={() => setSrc(null)}
      >
        ✕
      </button>
      <img src={src} alt="" />
    </div>
  )
}
