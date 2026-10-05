/**
 * Ending sequence timeline — pure (no DOM, no timers, no audio). The UI only reads these
 * cues; caption times come from data/clicker/ending.ts (showAt/hideAt), everything else
 * (video lengths, SFX sync, BGM fades, skip rules, stall limits) lives here.
 */

export type EndingVideoId = "guardian_death" | "core_awaken"
/** Videos play in order, then the story cards (which seal the record). */
export type EndingStage = EndingVideoId | "cards"

export const ENDING_VIDEO_ORDER: readonly EndingVideoId[] = ["guardian_death", "core_awaken"]

/** Exact lengths of the HQ renders (1920x1080, 30 fps) and of their 720p twins; SFX v2 files match them. */
export const ENDING_VIDEO_SECONDS: Readonly<Record<EndingVideoId, number>> = {
  guardian_death: 9.5,
  core_awaken: 10,
}

/** Which render of the ending videos to play: the 1920x1080 HQ cut or the 1280x720 mobile cut (same lengths, silent). */
export type EndingVideoQuality = "hq" | "mobile720"
/** Viewports at most this wide (CSS px: phones, small tablets in portrait) get the 720p cut. */
export const ENDING_NARROW_VIEWPORT_PX = 820
const SLOW_CONNECTIONS: readonly string[] = ["slow-2g", "2g", "3g"]

export type EndingMediaHint = {
  viewportWidth: number
  /** navigator.connection.saveData */
  saveData?: boolean
  /** navigator.connection.effectiveType */
  effectiveType?: string
}

/** Narrow viewport, data-saver or a slow connection -> 720p; anything unknown stays HQ (the 24 MB cut). */
export function pickEndingVideoQuality(hint: EndingMediaHint): EndingVideoQuality {
  if (hint.saveData === true) return "mobile720"
  if (hint.effectiveType && SLOW_CONNECTIONS.includes(hint.effectiveType)) return "mobile720"
  if (Number.isFinite(hint.viewportWidth) && hint.viewportWidth > 0 && hint.viewportWidth <= ENDING_NARROW_VIEWPORT_PX) return "mobile720"
  return "hq"
}

/** Caption fade in/out, inside [showAt, hideAt] so a caption is gone by hideAt. */
export const CAPTION_FADE_S = 0.4
/** Skip (button or key) is ignored this long after a video stage starts: a held Space / queued tap from the boss fight must not skip. */
export const SKIP_GUARD_S = 0.6
/** The SFX is slaved to the video clock; re-seek it when it drifts further than this. */
export const SFX_DRIFT_TOLERANCE_S = 0.12
export const SFX_FADE_OUT_S = 0.25
/** Ending score (non-looping, ~112 s) starts with the story cards. */
export const BGM_FADE_IN_S = 1.5
export const BGM_FADE_OUT_S = 1.2
/** No first frame within this long -> skip the stage (never strand the player). */
export const LOAD_TIMEOUT_S = 8
/** Playback frozen (visible tab, not ended) for this long -> skip the stage. */
export const STALL_LIMIT_S = 6

export type CaptionStep = { id: string; video?: EndingVideoId; showAt?: number; hideAt?: number }
export type CaptionCue = { id: string; showAt: number; hideAt: number }

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n)

/**
 * Sanitised cues for one video: clamped to the video length, invalid/empty windows dropped,
 * sorted, and overlaps trimmed (an earlier caption ends where the next one starts).
 */
export function captionCues(steps: readonly CaptionStep[], video: EndingVideoId): CaptionCue[] {
  const length = ENDING_VIDEO_SECONDS[video]
  const cues: CaptionCue[] = []
  for (const s of steps) {
    if (s.video !== video || !finite(s.showAt) || !finite(s.hideAt)) continue
    const showAt = Math.max(0, s.showAt)
    const hideAt = Math.min(length, s.hideAt)
    if (hideAt > showAt) cues.push({ id: s.id, showAt, hideAt })
  }
  cues.sort((a, b) => a.showAt - b.showAt)
  for (let i = 0; i < cues.length - 1; i++) cues[i].hideAt = Math.min(cues[i].hideAt, cues[i + 1].showAt)
  return cues.filter((c) => c.hideAt > c.showAt)
}

/** Caption visible at video time `t` with its fade opacity (0..1), or null. */
export function captionAt(cues: readonly CaptionCue[], t: number): { id: string; opacity: number } | null {
  for (const c of cues) {
    if (t < c.showAt || t >= c.hideAt) continue
    const fade = Math.min(CAPTION_FADE_S, (c.hideAt - c.showAt) / 2)
    const opacity = Math.min((t - c.showAt) / fade, (c.hideAt - t) / fade, 1)
    return { id: c.id, opacity: Math.max(0, opacity) }
  }
  return null
}

/** Reduced motion skips the (flashing, high-motion) videos and goes straight to the cards. */
export function endingStages(reducedMotion: boolean): EndingStage[] {
  return reducedMotion ? ["cards"] : [...ENDING_VIDEO_ORDER, "cards"]
}

export function nextEndingStage(stage: EndingStage, reducedMotion: boolean): EndingStage | null {
  const list = endingStages(reducedMotion)
  const i = list.indexOf(stage)
  return i >= 0 && i + 1 < list.length ? list[i + 1] : null
}

export type SkipInput = { stage: EndingStage; elapsedS: number; viaKey?: { repeat: boolean } }
export function skipAllowed({ stage, elapsedS, viaKey }: SkipInput): boolean {
  if (stage === "cards") return false
  if (viaKey?.repeat) return false
  return elapsedS >= SKIP_GUARD_S
}

/** Where the SFX should be, and whether it has to be moved, given the video clock. */
export function sfxSync(videoT: number, sfxT: number, video: EndingVideoId): { seekTo: number | null; stop: boolean } {
  const length = ENDING_VIDEO_SECONDS[video]
  if (videoT >= length) return { seekTo: null, stop: true }
  return { seekTo: Math.abs(videoT - sfxT) > SFX_DRIFT_TOLERANCE_S ? Math.max(0, videoT) : null, stop: false }
}

/** BGM cue: the ending score plays only on the cards; the world score is silenced for the whole ending. */
export function endingBgmOn(stage: EndingStage): boolean {
  return stage === "cards"
}

export type StageWatchdog = { started: boolean; waitedS: number; stalledS: number; lastT: number }
export const newWatchdog = (): StageWatchdog => ({ started: false, waitedS: 0, stalledS: 0, lastT: -1 })

/**
 * One watchdog tick. Time spent in a hidden tab never counts. Returns the next state and
 * whether the stage should be abandoned.
 */
export function stepWatchdog(
  w: StageWatchdog,
  input: { dtS: number; videoT: number; hidden: boolean; ended: boolean },
): { next: StageWatchdog; expired: boolean } {
  if (input.hidden || input.ended) return { next: { ...w, lastT: input.videoT }, expired: false }
  const progressed = input.videoT > w.lastT + 0.001
  const started = w.started || input.videoT > 0
  const next: StageWatchdog = {
    started,
    lastT: input.videoT,
    waitedS: started ? w.waitedS : w.waitedS + input.dtS,
    stalledS: started && !progressed ? w.stalledS + input.dtS : 0,
  }
  return { next, expired: next.waitedS >= LOAD_TIMEOUT_S || next.stalledS >= STALL_LIMIT_S }
}

/**
 * Start the ending when the guardian is down and the record is not sealed yet — also after a
 * reload mid-ending — but never while a sequence is already running (double-trigger guard).
 */
export function shouldStartEnding(s: { bossDefeated: boolean; gameCompleted: boolean; active: boolean }): boolean {
  return s.bossDefeated && !s.gameCompleted && !s.active
}
