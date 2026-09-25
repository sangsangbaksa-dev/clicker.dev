"use client"

import { useEffect, useRef, useState, type ImgHTMLAttributes, type KeyboardEvent, type MouseEvent } from "react"
import { createPortal } from "react-dom"

/**
 * A card thumbnail that opens full size on click / Enter. Stays a bare <img> so the
 * existing `.clicker-card > img` grid and icon styles keep applying; the viewer is a
 * modal <dialog> portalled to <body> (top layer, so card hover transforms can't trap it).
 */
export function ClickerZoomImage({
  src,
  label,
  className,
  onError,
  ...rest
}: Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "onClick"> & { src: string; label: string }) {
  const [open, setOpen] = useState(false)
  // onError may swap the thumbnail to a fallback; the viewer shows whatever loaded.
  const [fallback, setFallback] = useState<{ from: string; to: string } | null>(null)
  const shown = fallback?.from === src ? fallback.to : src
  const dialogRef = useRef<HTMLDialogElement | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (open && dialog && !dialog.open) dialog.showModal()
  }, [open])

  const openViewer = (e: MouseEvent | KeyboardEvent) => {
    // Cards react to clicks (select / pop); the zoom is its own action.
    e.stopPropagation()
    setOpen(true)
  }

  return (
    <>
      <img
        {...rest}
        src={src}
        alt=""
        role="button"
        tabIndex={0}
        aria-label={`${label} 이미지 크게 보기`}
        aria-haspopup="dialog"
        className={`clicker-zoomable${className ? ` ${className}` : ""}`}
        onClick={openViewer}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            openViewer(e)
          }
        }}
        onError={(e) => {
          onError?.(e)
          setFallback({ from: src, to: e.currentTarget.src })
        }}
      />
      {open
        ? createPortal(
            <dialog
              ref={dialogRef}
              className="clicker-zoom-dialog"
              aria-label={label}
              onClose={() => setOpen(false)}
              onKeyDown={(e) => {
                // Claim Esc before the app's window listeners (they skip prevented events)
                // so it closes only the viewer, not the panel underneath.
                if (e.key !== "Escape") return
                e.preventDefault()
                e.stopPropagation()
                dialogRef.current?.close()
              }}
              onClick={(e) => {
                e.stopPropagation()
                dialogRef.current?.close()
              }}
            >
              <figure className="clicker-zoom-figure">
                <img src={shown} alt={label} />
                <figcaption>{label}</figcaption>
              </figure>
              <button type="button" className="clicker-zoom-close" aria-label="닫기" autoFocus>
                ✕
              </button>
            </dialog>,
            document.body,
          )
        : null}
    </>
  )
}
