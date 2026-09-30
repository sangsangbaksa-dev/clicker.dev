"use client"

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react"
import { isConfirmReady } from "@/application/clicker-ui"

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

/**
 * Wraps the handler of a button that just replaced another in the same spot, so the
 * tail of a double-click (or a held Enter) cannot press it. `shownKey` changes whenever
 * the button (re)appears; presses within CONFIRM_ARM_MS of that are dropped.
 */
export function useArmedPress(shownKey: unknown) {
  const shownAtRef = useRef<number | null>(null)
  useEffect(() => {
    shownAtRef.current = performance.now()
  }, [shownKey])
  return (handler: () => void) => () => {
    if (isConfirmReady(shownAtRef.current, performance.now())) handler()
  }
}

/** Moves focus to `target` whenever `key` changes after mount (not on the first render). */
export function useFocusOnChange(target: RefObject<HTMLElement | null>, key: unknown) {
  const firstRef = useRef(true)
  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false
      return
    }
    target.current?.focus({ preventScroll: true })
  }, [target, key])
}
