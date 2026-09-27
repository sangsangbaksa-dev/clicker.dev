import { useEffect, useState } from "react"

const IMAGE_RE = /\.(webp|png|jpe?g|gif|svg)$/i
const warmed = new Map<string, Promise<void>>()

/** Fetch and decode an image once; later shows paint it without a blank or stale frame. */
export function warmImage(src: string): Promise<void> {
  let job = warmed.get(src)
  if (!job) {
    const img = new Image()
    img.src = src
    job = img.decode().catch(() => undefined)
    warmed.set(src, job)
  }
  return job
}

/** Every image path found anywhere in the given data (config, asset tables). */
export function collectImagePaths(...roots: unknown[]): string[] {
  const out = new Set<string>()
  const seen = new Set<unknown>()
  const walk = (v: unknown) => {
    if (typeof v === "string") {
      if (/^\/?clicker\//.test(v) && IMAGE_RE.test(v)) out.add(v)
    } else if (v && typeof v === "object" && !seen.has(v)) {
      seen.add(v)
      for (const x of Object.values(v)) walk(x)
    }
  }
  for (const r of roots) walk(r)
  return [...out]
}

/** Warm images a few at a time in idle time so startup and clicks stay smooth. */
export function useImagePreload(paths: string[]) {
  useEffect(() => {
    let cancelled = false
    const queue = [...paths]
    const idle = (cb: () => void) => {
      if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(cb, { timeout: 800 })
      else setTimeout(cb, 60)
    }
    const step = () => {
      if (cancelled || !queue.length) return
      Promise.all(queue.splice(0, 4).map(warmImage)).then(() => idle(step))
    }
    idle(step)
    return () => {
      cancelled = true
    }
  }, [paths])
}

/** Keep showing the previous image until the next one is decoded — no flash of a blank or wrong image. */
export function useDecodedSrc(src: string): string {
  const [shown, setShown] = useState(src)
  useEffect(() => {
    let live = true
    warmImage(src).then(() => {
      if (live) setShown(src)
    })
    return () => {
      live = false
    }
  }, [src])
  return shown
}
