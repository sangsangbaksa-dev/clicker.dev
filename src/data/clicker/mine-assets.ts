/** Mine chamber art pack — paths only; Waldomage + Waldo handoff. Palette PROVISIONAL. */

export const MINE_ENTRANCE_FRAME_WIDTH = 1280
export const MINE_ENTRANCE_FRAME_HEIGHT = 720
/** Vertical seam between door panels in pre-reframe v2 still (symmetry scan; see media/mine-entrance-reframe/). */
export const MINE_ENTRANCE_DOOR_SEAM_X_SOURCE = 657
/** After reframe, seam is aligned to frame center. */
export const MINE_ENTRANCE_DOOR_SEAM_X = MINE_ENTRANCE_FRAME_WIDTH / 2
/** Pixels to shift content left so `MINE_ENTRANCE_DOOR_SEAM_X_SOURCE` lands on frame center. */
export const MINE_ENTRANCE_REFRAME_SHIFT_PX = MINE_ENTRANCE_DOOR_SEAM_X_SOURCE - MINE_ENTRANCE_DOOR_SEAM_X

export const MINE_ENTER_CINEMATIC_WIDTH = 1920
export const MINE_ENTER_CINEMATIC_HEIGHT = 1080
/** Door seam x on the 1080p door-walk (symmetry scan on f000; matches still at 720p center). */
export const MINE_ENTER_DOOR_SEAM_X_1080P = 960

/** Interior with the single big center crystal — the clickable mining target. */
export const MINE_ORE_PLATE = {
  src: "/clicker/mine/mine_interior_mineral_ore_v2.webp",
  width: 1920,
  height: 1080,
  /** Crystal bounds inside the plate (px @ 1920×1080). */
  ore: { x: 732, y: 312, w: 477, h: 486 },
} as const

export const MineArt = {
  /** Hub pre-enter closed door; matches door-walk f000 (seam x=640 @ 720p). */
  entranceGate: "/clicker/mine/mine_entrance_hub_closed_door_v2.webp",
  /** Same gate, cropped so the door's centre is the image centre (title screen). */
  titleGate: "/clicker/mine/title_door_centered.webp",
  /**
   * Entry cinematic v19 (1920×1080, 10 s, scripts/clicker-mine-enter.py): from `entranceGate` the
   * trim lights pulse, steam vents and the lock clunks (camera kick), the door cracks at its seam
   * (x=960), holds, then its thick halves slide open; the chamber powers up behind a shadowed doorway,
   * its light blooms through the gap onto the floor and the dust, and the camera pushes through with
   * motion blur to ease out exactly on `orePlate`; no frozen tail, and both cuts are seamless.
   */
  enterCinematic: "/clicker/mine/mine_enter_door_walk_v19.mp4",
  /** Previous 720p door-walk (kept on disk for reference). */
  enterCinematicV11: "/clicker/mine/mine_enter_door_walk_v11.mp4",
  /** Timed-session hi-tech interior — full-bleed chamber. */
  chamberBg: "/clicker/mine/mine_interior_hitech_v1.webp",
  /**
   * 1080p hi-tech chamber still (same crystal framing as `orePlate`; richer walls/lighting).
   * Fades in over the door-walk landing plate after enter so the cinematic seam stays clean.
   */
  chamberInteriorMineral1080pV1: "/clicker/mine/mine_interior_hitech_mineral_1080p_v1.webp",
  /** Door-walk v19 landing frame — keep as the first paint after the enter cinematic. */
  orePlate: MINE_ORE_PLATE.src,
  /** The plate's blue strip lights, recoloured hot orange (same framing): FEVER pulses only these. */
  feverLights: "/clicker/mine/mine_fever_lights.webp",
  coreOre: "/clicker/mine/mine_core_ore_click_v1.webp",
  /** Sparse motes — screen blend over the chamber (skipped under prefers-reduced-motion). */
  dustOverlay: "/clicker/mine/mine_dust_overlay_v1.png",
  /** HUD bezel; center masked open so the ore stays readable. */
  uiChrome: "/clicker/mine/mine_ui_chrome_v1.png",
} as const
