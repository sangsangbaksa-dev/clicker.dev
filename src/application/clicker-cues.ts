/*
 * What components and hooks use for file-based sound cues: the pure rules (which cue for which
 * event) and the player handle. Components do not import the domain or infrastructure directly.
 */
export {
  GUARDIAN_ENRAGE_CUE_AT,
  drillLoopExpired,
  drillTapPlan,
  guardianAudioPlan,
  navTabCue,
  DRILL_LOOP_IDLE_MS,
} from "@/domain/services/clicker-audio-cues"
export type { CueId, GuardianAudioPlan, GuardianAudioSnap } from "@/domain/services/clicker-audio-cues"
export { clickerCues } from "@/application/clicker-cue-player"
export type { ClickerCuePlayer } from "@/application/clicker-cue-player"
