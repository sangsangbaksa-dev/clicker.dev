/**
 * Rebirth keyframes (pure): one full-screen painting per beat of the rebirth sequence, in beat order.
 * The sequence's own timing (data/rebirth-motion.ts) decides when a beat is shown; this only says which
 * file belongs to which beat, so UI and data never hard-code the numbering.
 */

export const REBIRTH_KEYFRAME_PHASES = ["select_confirm", "collapse", "void_tear", "stamp", "rebuild", "settle"] as const
export type RebirthKeyframePhase = (typeof REBIRTH_KEYFRAME_PHASES)[number]

/** File stems under public/clicker/rebirth/ (frame 01 is the v2 art with the core on the centre line). */
const FILE_BY_PHASE: Record<RebirthKeyframePhase, string> = {
  select_confirm: "rebirth_kf_01_select_confirm_v2.webp",
  collapse: "rebirth_kf_02_collapse_v1.webp",
  void_tear: "rebirth_kf_03_void_tear_v1.webp",
  stamp: "rebirth_kf_04_stamp_v1.webp",
  rebuild: "rebirth_kf_05_rebuild_v1.webp",
  settle: "rebirth_kf_06_settle_v1.webp",
}

export function rebirthKeyframeFile(phase: RebirthKeyframePhase): string {
  return FILE_BY_PHASE[phase]
}

/** Keyframes to warm up while the player is still in the picker, in the order they will be shown. */
export function rebirthKeyframePreloadOrder(): readonly string[] {
  return REBIRTH_KEYFRAME_PHASES.map(rebirthKeyframeFile)
}
