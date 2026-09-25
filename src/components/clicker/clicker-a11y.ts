"use client"

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react"

/** Soft Esc dismiss — no focus trap, respects prior preventDefault. */
export function useClickerEscape(enabled: boolean, onEscape: () => void) {
  const onEscapeRef = useRef(onEscape)
  useLayoutEffect(() => {
    onEscapeRef.current = onEscape
  })

  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return
      e.preventDefault()
      onEscapeRef.current()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [enabled])
}

/**
 * Focus the first actionable control when a dialog mounts; restore prior focus on unmount.
 * Soft only — does not trap Tab inside the dialog.
 */
export function useClickerDialogFocus(
  containerRef: RefObject<HTMLElement | null>,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return
    const prev = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const root = containerRef.current
    if (!root) return

    const focusable = root.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    focusable?.focus({ preventScroll: true })

    return () => {
      if (prev && document.contains(prev)) {
        prev.focus({ preventScroll: true })
      }
    }
  }, [containerRef, enabled])
}
