/** Mine chamber art pack — paths only; Waldomage + Waldo handoff. Palette PROVISIONAL. */

/** Interior with the single big center crystal — the clickable mining target. */
export const MINE_ORE_PLATE = {
  src: "/clicker/mine/mine_interior_mineral_ore_v2.png",
  width: 1280,
  height: 720,
  /** Crystal bounds inside the plate (px). */
  ore: { x: 488, y: 208, w: 318, h: 324 },
} as const

export const MineArt = {
  /** Hub pre-enter closed door; identical to door-walk v11 f000 so the entry video starts seamlessly. */
  entranceGate: "/clicker/mine/mine_entrance_hub_closed_door_v1.png",
  /** Title-screen ambient loop over the closed door: glow pulse, floor fog, dust (8s, silent). */
  titleAmbientLoop: {
    webm: "/clicker/mine/mine_title_ambient_loop_v1.webm",
    mp4: "/clicker/mine/mine_title_ambient_loop_v1.mp4",
  },
  /** Door-walk v11 entry cinematic (1280×720, with SFX); ends on the ore plate. */
  enterCinematic: "/clicker/mine/mine_enter_door_walk_v11.mp4",
  /** Timed-session hi-tech interior — full-bleed chamber. */
  chamberBg: "/clicker/mine/mine_interior_hitech_v1.png",
  orePlate: MINE_ORE_PLATE.src,
  coreOre: "/clicker/mine/mine_core_ore_click_v1.png",
} as const
