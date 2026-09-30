import type { BgmTrackId } from "@/domain/services/clicker-bgm"

/** Public URLs for looping BGM (v2 mixes). */
export const CLICKER_BGM_URL: Record<BgmTrackId, string> = {
  hub: "/clicker/audio/bgm_hub_v2.mp3",
  mine: "/clicker/audio/bgm_mine_v2.mp3",
  chamber: "/clicker/audio/bgm_chamber_v2.mp3",
  relay: "/clicker/audio/bgm_world_relay.mp3",
  vault: "/clicker/audio/bgm_world_vault.mp3",
  storm: "/clicker/audio/bgm_world_storm.mp3",
  fault: "/clicker/audio/bgm_world_fault.mp3",
  heart: "/clicker/audio/bgm_world_heart.mp3",
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
  return Object.keys(CLICKER_BGM_URL) as BgmTrackId[]
}
