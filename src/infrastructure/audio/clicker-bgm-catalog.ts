import type { BgmTrackId } from "@/domain/services/clicker-bgm"

/** Public URLs for looping BGM — the original score for hub, mine and chamber. */
export const CLICKER_BGM_URL: Record<BgmTrackId, string> = {
  loading: "/clicker/audio/bgm_loading_loop_v2.mp3",
  hub: "/clicker/audio/bgm_hub_v2.mp3",
  mine: "/clicker/audio/bgm_mine_v2.mp3",
  chamber: "/clicker/audio/bgm_chamber_v2.mp3",
  rebirthIntro: "/clicker/audio/bgm_rebirth_hq_intro.mp3",
  rebirthHq: "/clicker/audio/bgm_rebirth_hq_loop.mp3",
  boss: "/clicker/audio/bgm_boss_loop_v1.mp3",
  relay: "/clicker/audio/bgm_world_relay.mp3",
  vault: "/clicker/audio/bgm_world_vault.mp3",
  storm: "/clicker/audio/bgm_world_storm.mp3",
  fault: "/clicker/audio/bgm_world_fault.mp3",
  heart: "/clicker/audio/bgm_world_heart.mp3",
}

/** Default loop=true; one-shot beds (rebirth intro) opt out. */
export const CLICKER_BGM_LOOP: Partial<Record<BgmTrackId, boolean>> = {
  rebirthIntro: false,
}

export function bgmTrackShouldLoop(id: BgmTrackId): boolean {
  return CLICKER_BGM_LOOP[id] ?? true
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
