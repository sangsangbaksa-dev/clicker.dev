"use client"

import { useEffect, useState } from "react"

/**
 * Tap any `img.clicker-zoomable` to see it large. Listens in the capture phase so the
 * tap opens the preview instead of also buying/selecting the card the image sits in.
 */
export function ClickerImageZoom() {
  const [src, setSrc] = useState<string | null>(null)

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
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSrc(null)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [src])

  if (!src) return null
  return (
    <div className="clicker-zoom" role="dialog" aria-modal="true" aria-label="이미지 크게 보기" onClick={() => setSrc(null)}>
      <img src={src} alt="" />
    </div>
  )
}
