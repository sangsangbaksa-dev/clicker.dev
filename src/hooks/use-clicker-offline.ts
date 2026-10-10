"use client"

import { useEffect, useSyncExternalStore } from "react"
import { isClickerStaticHost } from "@/application/clicker-static-host"

/**
 * Offline / installable app (static GitHub Pages build only). Registers the service worker
 * written by scripts/build-offline.mjs, keeps the browser's install prompt for the settings
 * sheet, and drives the "download everything" pass that makes the game playable offline.
 */

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

export type ClickerOfflineState = {
  /** Service worker available and registered (static build in a supporting browser). */
  supported: boolean
  /** Running as an installed app (home screen / desktop window). */
  installed: boolean
  /** The browser offered an install prompt we can show. */
  canInstall: boolean
  /** iOS Safari: no prompt — show the "Share → Add to Home Screen" hint instead. */
  iosHint: boolean
  downloading: boolean
  doneBytes: number
  totalBytes: number
  failed: number
  error: string | null
}

const BASE = process.env.NEXT_PUBLIC_PAGES_BASE_PATH ?? ""

let state: ClickerOfflineState = {
  supported: false,
  installed: false,
  canInstall: false,
  iosHint: false,
  downloading: false,
  doneBytes: 0,
  totalBytes: 0,
  failed: 0,
  error: null,
}
let deferredPrompt: InstallPrompt | null = null
let booted = false
const listeners = new Set<() => void>()

function set(patch: Partial<ClickerOfflineState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

function ask(type: "status" | "download-all", onMessage: (data: { type: string; doneBytes: number; total: number; failed?: number }) => void) {
  const worker = navigator.serviceWorker?.controller
  if (!worker) return false
  const channel = new MessageChannel()
  channel.port1.onmessage = (e) => onMessage(e.data)
  worker.postMessage({ type }, [channel.port2])
  return true
}

function refreshStatus() {
  ask("status", (d) => set({ doneBytes: d.doneBytes, totalBytes: d.total }))
}

function boot() {
  if (booted || typeof window === "undefined") return
  booted = true
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  const ua = navigator.userAgent
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && "ontouchend" in document)
  set({ installed: standalone, iosHint: ios && !standalone })

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault()
    deferredPrompt = e as InstallPrompt
    set({ canInstall: true })
  })
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null
    set({ canInstall: false, installed: true })
  })

  if (!isClickerStaticHost() || !("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return
  navigator.serviceWorker
    .register(`${BASE}/sw.js`, { scope: `${BASE}/` })
    .then(() => {
      set({ supported: true })
      if (navigator.serviceWorker.controller) refreshStatus()
      else navigator.serviceWorker.addEventListener("controllerchange", refreshStatus, { once: true })
    })
    .catch(() => set({ supported: false }))
}

export async function promptClickerInstall(): Promise<boolean> {
  if (!deferredPrompt) return false
  await deferredPrompt.prompt()
  const choice = await deferredPrompt.userChoice
  deferredPrompt = null
  set({ canInstall: false, installed: choice.outcome === "accepted" || state.installed })
  return choice.outcome === "accepted"
}

/** Fetch every image, video and sound into the offline cache (progress is reported live). */
export function downloadClickerOffline(): void {
  if (state.downloading) return
  set({ downloading: true, error: null, failed: 0 })
  // Ask for persistent storage so the browser does not evict the cache under pressure.
  void navigator.storage?.persist?.().catch(() => false)
  const ok = ask("download-all", (d) => {
    if (d.type === "progress") set({ doneBytes: d.doneBytes, totalBytes: d.total })
    if (d.type === "done") set({ downloading: false, doneBytes: d.doneBytes, totalBytes: d.total, failed: d.failed ?? 0 })
  })
  if (!ok) set({ downloading: false, error: "오프라인 엔진이 아직 준비되지 않았습니다. 잠시 후 다시 눌러 주세요." })
}

/** Start the service worker and install-prompt capture as early as possible (call once at app mount). */
export function useClickerOfflineBoot(): void {
  useEffect(() => {
    boot()
  }, [])
}

export function useClickerOffline(): ClickerOfflineState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  )
}
