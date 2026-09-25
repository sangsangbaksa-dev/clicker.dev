/** Waldomage rebirth motion pack — color roles are PROVISIONAL, not brand-locked. */

import { RebirthPhaseArt } from "./rebirth-assets.ts"

export type RebirthMotif = "pulse" | "grid" | "rings" | "core" | "hybrid"
export type RebirthParticleMode = "lanes" | "grid" | "orbit" | "jets" | "scatter"

export type RebirthPhaseId =
  | "select_confirm"
  | "collapse"
  | "void_tear"
  | "stamp"
  | "rebuild"
  | "settle"

export type WorldlineMotionVariant = {
  transcendenceId: string
  label: string
  primary: string
  accent: string
  motif: RebirthMotif
  particleMode: RebirthParticleMode
  /** Optional PNG stamp — geometric glyph used when absent */
  stampAssetId?: string
  /** Sheet 09 — reduced-motion still; geometric glyph when absent */
  reducedMotionStillAssetId?: string
}

const REBIRTH_HIGHLIGHT = "#E8F4FF"

/** Full timeline (ms) — rebirth-motion-spec §1; select_confirm widened for load-safe sampling. */
const REBIRTH_TIMELINE_FULL: Array<{ id: RebirthPhaseId; start: number; end: number }> = [
  { id: "select_confirm", start: 0, end: 350 },
  { id: "collapse", start: 350, end: 900 },
  { id: "void_tear", start: 900, end: 1500 },
  { id: "stamp", start: 1500, end: 2200 },
  { id: "rebuild", start: 2200, end: 3000 },
  { id: "settle", start: 3000, end: 3500 },
]

export const REBIRTH_DURATION_FULL_MS = 3500

/** Reduced motion — spec §Reduced motion, ≤1.5s */
const REBIRTH_TIMELINE_REDUCED: Array<{ id: RebirthPhaseId; start: number; end: number }> = [
  { id: "select_confirm", start: 0, end: 160 },
  { id: "collapse", start: 160, end: 400 },
  { id: "void_tear", start: 400, end: 550 },
  { id: "stamp", start: 550, end: 1050 },
  { id: "rebuild", start: 1050, end: 1300 },
  { id: "settle", start: 1300, end: 1500 },
]

export const REBIRTH_DURATION_REDUCED_MS = 1500

type VariantBase = Omit<WorldlineMotionVariant, "transcendenceId" | "stampAssetId" | "reducedMotionStillAssetId">

const VARIANTS: Record<string, VariantBase> = {
  focus_line: {
    label: "Directive Pulse",
    primary: "#00E5FF",
    accent: "#3D7EFF",
    motif: "pulse",
    particleMode: "lanes",
  },
  auto_line: {
    label: "AURELIA Grid",
    primary: "#FFC857",
    accent: "#E8A838",
    motif: "grid",
    particleMode: "grid",
  },
  reso_line: {
    label: "Resonance Protocol",
    primary: "#FF4DDC",
    accent: "#9B5CFF",
    motif: "rings",
    particleMode: "orbit",
  },
  risk_line: {
    label: "Volatile Core",
    primary: "#FF6A3D",
    accent: "#FF2E63",
    motif: "core",
    particleMode: "jets",
  },
  hybrid_line: {
    label: "Adaptive Architect",
    primary: "#6FE8C8",
    accent: "#4DA8FF",
    motif: "hybrid",
    particleMode: "scatter",
  },
}

export function rebirthVariantFor(transcendenceId: string): WorldlineMotionVariant {
  const base = VARIANTS[transcendenceId]
  if (!base) {
    return {
      transcendenceId,
      label: transcendenceId,
      primary: REBIRTH_HIGHLIGHT,
      accent: "#7AA2FF",
      motif: "hybrid",
      particleMode: "scatter",
    }
  }
  return {
    ...base,
    transcendenceId,
    stampAssetId: RebirthPhaseArt.stampFor(transcendenceId),
    reducedMotionStillAssetId: RebirthPhaseArt.reducedMotionStillFor(transcendenceId),
  }
}

export function rebirthPhaseAt(
  elapsedMs: number,
  reducedMotion: boolean
): { phase: RebirthPhaseId; phaseT: number; totalT: number } {
  const timeline = reducedMotion ? REBIRTH_TIMELINE_REDUCED : REBIRTH_TIMELINE_FULL
  const duration = reducedMotion ? REBIRTH_DURATION_REDUCED_MS : REBIRTH_DURATION_FULL_MS
  const totalT = Math.min(1, Math.max(0, elapsedMs / duration))
  const hit =
    timeline.find((p) => elapsedMs >= p.start && elapsedMs < p.end) ?? timeline[timeline.length - 1]
  const span = hit.end - hit.start
  const phaseT = span <= 0 ? 1 : (elapsedMs - hit.start) / span
  return { phase: hit.id, phaseT, totalT }
}

/** Audio cue placeholder names — no assets in this pack */
export const REBIRTH_AUDIO_CUES = {
  confirm: "sfx_rebirth_confirm_click",
  collapse: "sfx_rebirth_collapse_whoosh",
  voidTear: "sfx_rebirth_void_tear",
  stamp: (worldlineKey: string) => `sfx_rebirth_stamp_${worldlineKey}`,
  rebuild: "sfx_rebirth_rebuild_rise",
  settle: "sfx_rebirth_settle_chime",
} as const

export function rebirthAudioCueKey(transcendenceId: string): string {
  const map: Record<string, string> = {
    focus_line: "directive_pulse",
    auto_line: "aurelia_grid",
    reso_line: "resonance_protocol",
    risk_line: "volatile_core",
    hybrid_line: "adaptive_architect",
  }
  return map[transcendenceId] ?? "generic"
}
