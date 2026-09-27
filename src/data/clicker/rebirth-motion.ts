/** Waldomage rebirth motion pack — color roles are PROVISIONAL, not brand-locked. */

import { RebirthPhaseArt } from "./rebirth-assets.ts"

export type RebirthMotif = "pulse" | "grid" | "rings" | "core" | "hybrid"
export type RebirthParticleMode = "lanes" | "grid" | "orbit" | "jets" | "scatter"

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
