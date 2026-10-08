import type { MetaState } from "../entities/clicker.ts"

/** Visual identity for the mine hub, entry cinematic poster, session interior, and region drill. */
export type MineWorldlineThemeId =
  | "origin"
  | "focus_line"
  | "auto_line"
  | "reso_line"
  | "risk_line"
  | "hybrid_line"
  | "hunt_line"
  | "forge_line"
  | "memory_line"

export type MineWorldlineDecor = "none" | "pulse" | "grid" | "rings" | "jets" | "scatter"

/** Tokens consumed as CSS custom properties on `[data-clicker][data-mine-theme]`. */
export type MineWorldlineTheme = {
  readonly id: MineWorldlineThemeId
  readonly label: string
  readonly accent: string
  readonly accent2: string
  /** 0..1 entrance still / poster color wash */
  readonly entranceTint: number
  /** Plate filter stack (degrees / multipliers). */
  readonly plateHueRotate: number
  readonly plateSaturate: number
  readonly plateBrightness: number
  readonly fogOpacity: number
  readonly vignetteOpacity: number
  readonly decor: MineWorldlineDecor
  /**
   * Optional per-line gate / poster art (1280×720 webp). When absent, the shared gate + CSS tint is used.
   * @see `MINE_WORLDLINE_ART_MANIFEST` in the product report.
   */
  readonly entranceGateAsset?: string
  readonly enterPosterAsset?: string
}

const ORIGIN: MineWorldlineTheme = {
  id: "origin",
  label: "Core Chamber",
  accent: "#00E5FF",
  accent2: "#2F6F7E",
  entranceTint: 0.22,
  plateHueRotate: 0,
  plateSaturate: 1,
  plateBrightness: 1,
  fogOpacity: 0.35,
  vignetteOpacity: 0.45,
  decor: "pulse",
}

const THEMES: Record<MineWorldlineThemeId, MineWorldlineTheme> = {
  origin: ORIGIN,
  focus_line: {
    id: "focus_line",
    label: "Directive Pulse",
    accent: "#00E5FF",
    accent2: "#3D7EFF",
    entranceTint: 0.38,
    plateHueRotate: -4,
    plateSaturate: 1.12,
    plateBrightness: 1.02,
    fogOpacity: 0.42,
    vignetteOpacity: 0.5,
    decor: "pulse",
  },
  auto_line: {
    id: "auto_line",
    label: "AURELIA Grid",
    accent: "#FFC857",
    accent2: "#E8A838",
    entranceTint: 0.34,
    plateHueRotate: 18,
    plateSaturate: 1.08,
    plateBrightness: 1.04,
    fogOpacity: 0.3,
    vignetteOpacity: 0.48,
    decor: "grid",
  },
  reso_line: {
    id: "reso_line",
    label: "Resonance Protocol",
    accent: "#FF4DDC",
    accent2: "#9B5CFF",
    entranceTint: 0.36,
    plateHueRotate: 42,
    plateSaturate: 1.15,
    plateBrightness: 1.03,
    fogOpacity: 0.44,
    vignetteOpacity: 0.52,
    decor: "rings",
  },
  risk_line: {
    id: "risk_line",
    label: "Volatile Core",
    accent: "#FF6A3D",
    accent2: "#FF2E63",
    entranceTint: 0.4,
    plateHueRotate: -18,
    plateSaturate: 1.2,
    plateBrightness: 0.98,
    fogOpacity: 0.38,
    vignetteOpacity: 0.55,
    decor: "jets",
  },
  hybrid_line: {
    id: "hybrid_line",
    label: "Adaptive Architect",
    accent: "#6FE8C8",
    accent2: "#4DA8FF",
    entranceTint: 0.32,
    plateHueRotate: 8,
    plateSaturate: 1.1,
    plateBrightness: 1.05,
    fogOpacity: 0.36,
    vignetteOpacity: 0.46,
    decor: "scatter",
  },
  hunt_line: {
    id: "hunt_line",
    label: "Predator Accord",
    accent: "#FF3B3B",
    accent2: "#B3122E",
    entranceTint: 0.42,
    plateHueRotate: -8,
    plateSaturate: 1.18,
    plateBrightness: 0.96,
    fogOpacity: 0.4,
    vignetteOpacity: 0.58,
    decor: "jets",
  },
  forge_line: {
    id: "forge_line",
    label: "Molten Covenant",
    accent: "#FF9A2E",
    accent2: "#FF5A1F",
    entranceTint: 0.44,
    plateHueRotate: 12,
    plateSaturate: 1.22,
    plateBrightness: 1.06,
    fogOpacity: 0.34,
    vignetteOpacity: 0.5,
    decor: "grid",
  },
  memory_line: {
    id: "memory_line",
    label: "Echo Archive",
    accent: "#B98CFF",
    accent2: "#6A4DFF",
    entranceTint: 0.36,
    plateHueRotate: 28,
    plateSaturate: 1.12,
    plateBrightness: 1.02,
    fogOpacity: 0.46,
    vignetteOpacity: 0.54,
    decor: "rings",
  },
}

const KNOWN = new Set<string>(Object.keys(THEMES))

/** The walked worldline that should tint the mine right now (latest transcendence pick). */
export function activeMineWorldlineThemeId(meta: MetaState): MineWorldlineThemeId {
  const last = meta.transcendenceIds[meta.transcendenceIds.length - 1]
  if (last && KNOWN.has(last)) return last as MineWorldlineThemeId
  return "origin"
}

export function mineWorldlineTheme(id: MineWorldlineThemeId): MineWorldlineTheme {
  return THEMES[id] ?? ORIGIN
}

/** Inline style map for the clicker shell (`--mine-*` custom properties). */
export function mineWorldlineThemeCssVars(theme: MineWorldlineTheme): Record<string, string> {
  return {
    "--mine-accent": theme.accent,
    "--mine-accent-2": theme.accent2,
    "--mine-entrance-tint": String(theme.entranceTint),
    "--mine-plate-hue": `${theme.plateHueRotate}deg`,
    "--mine-plate-saturate": String(theme.plateSaturate),
    "--mine-plate-brightness": String(theme.plateBrightness),
    "--mine-fog-opacity": String(theme.fogOpacity),
    "--mine-vignette-opacity": String(theme.vignetteOpacity),
  }
}
