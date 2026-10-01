"use client"

import { useEffect, useRef } from "react"
import {
  decideSpaceKeydown,
  isTypingTarget,
  resolveSpacePoint,
  SPACE_HOLD_INTERVAL_MS,
  type Point,
} from "@/domain/services/clicker-space-input"

type Options = {
  getOreCenter: () => Point | null
  click: (clientX: number, clientY: number) => void
}

function modalIsOpen(): boolean {
  return document.querySelector('[role="dialog"][aria-modal="true"]') !== null
}

export function useClickerSpaceClick({ getOreCenter, click }: Options) {
  const live = useRef({ getOreCenter, click })
  useEffect(() => {
    live.current = { getOreCenter, click }
  })

  useEffect(() => {
    let timer = 0
    let pointer: Point | null = null
    const fire = () => {
      const center = live.current.getOreCenter()
      const p = pointer ?? (center ? resolveSpacePoint(null, center) : null)
      if (p) live.current.click(p.x, p.y)
    }
    const stop = () => {
      if (timer) window.clearInterval(timer)
      timer = 0
    }
    const onMove = (e: PointerEvent) => {
      pointer = { x: e.clientX, y: e.clientY }
    }
    const onDown = (e: KeyboardEvent) => {
      const t = e.target instanceof HTMLElement ? e.target : null
      const action = decideSpaceKeydown({
        code: e.code,
        repeat: e.repeat,
        ctrl: e.ctrlKey,
        meta: e.metaKey,
        alt: e.altKey,
        typing: isTypingTarget(t?.tagName, Boolean(t?.isContentEditable)),
        modalOpen: modalIsOpen(),
        holding: timer !== 0,
      })
      if (action === "ignore") {
        stop()
        return
      }
      e.preventDefault()
      if (action === "swallow") return
      fire()
      timer = window.setInterval(fire, SPACE_HOLD_INTERVAL_MS)
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return
      if (timer) e.preventDefault()
      stop()
    }
    window.addEventListener("pointermove", onMove, { passive: true })
    window.addEventListener("pointerdown", onMove, { passive: true })
    window.addEventListener("keydown", onDown)
    window.addEventListener("keyup", onUp)
    window.addEventListener("blur", stop)
    return () => {
      stop()
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerdown", onMove)
      window.removeEventListener("keydown", onDown)
      window.removeEventListener("keyup", onUp)
      window.removeEventListener("blur", stop)
    }
  }, [])
}
