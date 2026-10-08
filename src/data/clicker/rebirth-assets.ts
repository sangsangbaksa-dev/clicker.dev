/** Waldomage rebirth art pack — Wave A stills in public/clicker/rebirth/. Palette PROVISIONAL. */

const DIR = "/clicker/rebirth"

/** Worldline id → art slug used in rebirth pack filenames. */
const SLUG: Record<string, string> = {
  focus_line: "directive_pulse",
  auto_line: "aurelia_grid",
  reso_line: "resonance_protocol",
  risk_line: "volatile_core",
}

/** Stamps for worldlines outside the Wave A pack: a legacy geometric stamp, or the late lines' sigils. */
const STAMP_FALLBACK: Record<string, string> = {
  hybrid_line: `${DIR}/rebirth_stamp_adaptive_architect_v2.webp`,
  // Late worldlines stamp with their own sigil.
  hunt_line: "/clicker/buff/buff_hunt.webp",
  forge_line: "/clicker/buff/buff_forge.webp",
  memory_line: "/clicker/buff/buff_memory.webp",
}

/** Four-card chrome set from sheet 08; other worldlines use the geometric card. */
export const REBIRTH_CHROME_WORLDLINE_IDS = Object.keys(SLUG)

type PlatePhase = "collapse" | "void_tear" | "stamp" | "rebuild" | "settle"

export const RebirthPhaseArt = {
  /** 1920×1080 worldline picker backdrop (dark lower band for cards). */
  worldlineSelectBg: `${DIR}/rebirth_worldline_select_bg_v1.webp`,
  /** Key visual: void tear + nascent core; also settle-phase flash backdrop. */
  keyVisualVoidTear: `${DIR}/rebirth_key_visual_void_tear_v1.webp`,
  // v2: painted 1920×1080 plates (Canva) replacing the flat Wave A placeholders.
  collapseShared: `${DIR}/rebirth_collapse_shared_v2.webp`,
  rebuildShared: `${DIR}/rebirth_rebuild_shared_v2.webp`,
  settleShared: `${DIR}/rebirth_settle_shared_v2.webp`,
  particlesShared: `${DIR}/rebirth_particles_shared_v2.webp`,
  particlesResonanceProtocol: `${DIR}/rebirth_particles_resonance_protocol_v2.webp`,
  particlesVolatileCore: `${DIR}/rebirth_particles_volatile_core_v2.webp`,
  voidTearShared: `${DIR}/rebirth_void_tear_shared_v1.webp`,
  selectChromeShared: `${DIR}/rebirth_worldline_select_chrome_shared_v1.webp`,
  selectFocus: `${DIR}/rebirth_worldline_select_focus_v1.webp`,
  selectLocked: `${DIR}/rebirth_worldline_select_locked_v1.webp`,
  selectConfirmFlash: `${DIR}/rebirth_worldline_select_confirm_flash_v1.webp`,
  hudRebuildWire: `${DIR}/rebirth_hud_rebuild_wire_v1.webp`,
  hudRebuildFill: `${DIR}/rebirth_hud_rebuild_fill_v1.webp`,

  stampFor(transcendenceId: string): string | undefined {
    const slug = SLUG[transcendenceId]
    return slug ? `${DIR}/rebirth_stamp_${slug}_v2.webp` : STAMP_FALLBACK[transcendenceId]
  },

  /** Sheet 09 still for prefers-reduced-motion; geometric glyph when absent. */
  reducedMotionStillFor(transcendenceId: string): string | undefined {
    const slug = SLUG[transcendenceId]
    // The painted stamp doubles as the reduced-motion still.
    return slug ? `${DIR}/rebirth_stamp_${slug}_v2.webp` : STAMP_FALLBACK[transcendenceId]
  },

  /** Stamp-phase particle plate; resonance / volatile worldlines use their own v2 plates. */
  particlesFor(transcendenceId: string): string {
    if (transcendenceId === "reso_line") return RebirthPhaseArt.particlesResonanceProtocol
    if (transcendenceId === "risk_line") return RebirthPhaseArt.particlesVolatileCore
    return RebirthPhaseArt.particlesShared
  },

  plateForPhase(phase: PlatePhase, transcendenceId?: string): string {
    if (phase === "collapse") return RebirthPhaseArt.collapseShared
    if (phase === "void_tear") return RebirthPhaseArt.keyVisualVoidTear
    if (phase === "rebuild") return RebirthPhaseArt.rebuildShared
    if (phase === "settle") return RebirthPhaseArt.settleShared
    if (phase === "stamp") return RebirthPhaseArt.particlesFor(transcendenceId ?? "")
    return RebirthPhaseArt.particlesShared
  },

  /** HUD plate crossfade for rebuild→settle (MW-03 / sheet 11). */
  hudPlateFor(phase: "rebuild" | "settle", phaseT: number): string {
    if (phase === "settle") return RebirthPhaseArt.settleShared
    // The painted rebuild plate replaces the flat wire → fill HUD sketches.
    void phaseT
    return RebirthPhaseArt.rebuildShared
  },

  /** Full-screen backdrop for void tear / settle (HUD chrome layers above). */
  keyVisualBackdropFor(phase: PlatePhase): string | undefined {
    if (phase === "void_tear") return RebirthPhaseArt.keyVisualVoidTear
    return undefined
  },
}

/** Every image the rebirth sequence shows for a worldline, in the order it shows them. */
export function rebirthArtFor(transcendenceId: string): string[] {
  const phases: PlatePhase[] = ["collapse", "void_tear", "stamp", "rebuild", "settle"]
  const urls = phases.map((p) => RebirthPhaseArt.keyVisualBackdropFor(p) ?? RebirthPhaseArt.plateForPhase(p, transcendenceId))
  const stamp = RebirthPhaseArt.stampFor(transcendenceId)
  return [...new Set(stamp ? [...urls, stamp] : urls)]
}
