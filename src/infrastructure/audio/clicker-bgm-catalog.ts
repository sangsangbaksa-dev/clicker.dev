import type { BgmTrackId } from "@/domain/services/clicker-bgm"
import { BGM_TRACK_IDS, bgmTrackLoops, bgmTrackUrl } from "@/domain/services/clicker-bgm-tracks"

/** Public URLs for the BGM tracks, derived from the domain registry (which file, which format, loop or not). */
export const CLICKER_BGM_URL: Record<BgmTrackId, string> = Object.fromEntries(
  BGM_TRACK_IDS.map((id) => [id, bgmTrackUrl(id)]),
) as Record<BgmTrackId, string>

export function bgmTrackShouldLoop(id: BgmTrackId): boolean {
  return bgmTrackLoops(id)
}

const warmed = new Map<string, Promise<void>>()

/** Warm decode for one track so the first play does not hitch (no-op when networking is blocked). */
export function warmBgmUrl(url: string, allowNetwork = true): Promise<void> {
  if (!allowNetwork || typeof window === "undefined") return Promise.resolve()
  let job = warmed.get(url)
  if (!job) {
    job = new Promise<void>((resolve) => {
      const audio = new Audio()
      audio.preload = "auto"
      audio.src = url
      const done = () => resolve()
      audio.addEventListener("canplaythrough", done, { once: true })
      audio.addEventListener("error", done, { once: true })
      void audio.load()
    })
    warmed.set(url, job)
  }
  return job
}

export function warmBgmTracks(ids: BgmTrackId[], allowNetwork = true): void {
  if (!allowNetwork) return
  for (const id of ids) void warmBgmUrl(CLICKER_BGM_URL[id], true)
}

export function allBgmTrackIds(): BgmTrackId[] {
  return [...BGM_TRACK_IDS]
}
