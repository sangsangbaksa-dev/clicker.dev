/** Waldomage rebirth art pack — Wave A stills under /clicker/rebirth/. Palette PROVISIONAL. */

const DIR = "/clicker/rebirth"

/** Worldline id → art slug used in rebirth pack filenames. */
const SLUG: Record<string, string> = {
  focus_line: "directive_pulse",
  auto_line: "aurelia_grid",
  reso_line: "resonance_protocol",
  risk_line: "volatile_core",
}

/** Legacy geometric stamps under /clicker/stamp/ — the only art for hybrid_line. */
const STAMP_FALLBACK: Record<string, string> = {
  hybrid_line: "/clicker/stamp/stamp_adaptive_architect.webp",
}

/** Four-card chrome set from sheet 08; other worldlines use the geometric card. */
export const REBIRTH_CHROME_WORLDLINE_IDS = Object.keys(SLUG)

type PlatePhase = "collapse" | "void_tear" | "stamp" | "rebuild" | "settle"

export const RebirthPhaseArt = {
  collapseShared: `${DIR}/rebirth_collapse_shared_v1.webp`,
  rebuildShared: `${DIR}/rebirth_rebuild_shared_v1.webp`,
  settleShared: `${DIR}/rebirth_settle_shared_v1.webp`,
  particlesShared: `${DIR}/rebirth_particles_shared_v1.webp`,
  voidTearShared: `${DIR}/rebirth_void_tear_shared_v1.webp`,
  selectChromeShared: `${DIR}/rebirth_worldline_select_chrome_shared_v1.webp`,
  selectFocus: `${DIR}/rebirth_worldline_select_focus_v1.webp`,
  selectLocked: `${DIR}/rebirth_worldline_select_locked_v1.webp`,
  selectConfirmFlash: `${DIR}/rebirth_worldline_select_confirm_flash_v1.webp`,
  hudRebuildWire: `${DIR}/rebirth_hud_rebuild_wire_v1.webp`,
  hudRebuildFill: `${DIR}/rebirth_hud_rebuild_fill_v1.webp`,

  stampFor(transcendenceId: string): string | undefined {
    const slug = SLUG[transcendenceId]
    return slug ? `${DIR}/rebirth_stamp_${slug}_v1.webp` : STAMP_FALLBACK[transcendenceId]
  },

  /** Sheet 09 still for prefers-reduced-motion; geometric glyph when absent. */
  reducedMotionStillFor(transcendenceId: string): string | undefined {
    const slug = SLUG[transcendenceId]
    return slug ? `${DIR}/rebirth_reduced_motion_${slug}_v1.webp` : undefined
  },

  plateForPhase(phase: PlatePhase): string {
    if (phase === "collapse") return RebirthPhaseArt.collapseShared
    if (phase === "void_tear") return RebirthPhaseArt.voidTearShared
    if (phase === "rebuild") return RebirthPhaseArt.rebuildShared
    if (phase === "settle") return RebirthPhaseArt.settleShared
    return RebirthPhaseArt.particlesShared
  },

  /** HUD plate crossfade for rebuild→settle (MW-03 / sheet 11). */
  hudPlateFor(phase: "rebuild" | "settle", phaseT: number): string {
    if (phase === "settle") return RebirthPhaseArt.settleShared
    return phaseT < 0.55 ? RebirthPhaseArt.hudRebuildWire : RebirthPhaseArt.hudRebuildFill
  },
}
