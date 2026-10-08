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
  width: 1280,
  height: 720,
  /** Crystal bounds inside the plate (px). */
  ore: { x: 488, y: 208, w: 318, h: 324 },
} as const

export const MineArt = {
  /** Hub pre-enter closed door; matches door-walk f000 (seam x=640 @ 720p). */
  entranceGate: "/clicker/mine/mine_entrance_hub_closed_door_v2.webp",
  /** Same gate, cropped so the door's centre is the image centre (title screen). */
  titleGate: "/clicker/mine/title_door_centered.webp",
  /**
   * Entry cinematic v18 (1920×1080, 10 s, scripts/clicker-mine-enter.py): from `entranceGate` the
   * trim lights pulse, the lock clunks (camera kick), the door cracks at its seam (x=960), holds,
   * then slides open while the camera pushes through with motion blur and eases out exactly on
   * `orePlate`; no frozen tail, and both cuts are seamless.
   */
  enterCinematic: "/clicker/mine/mine_enter_door_walk_v18.mp4",
  /** Previous 720p door-walk (kept on disk for reference). */
  enterCinematicV11: "/clicker/mine/mine_enter_door_walk_v11.mp4",
  /** Timed-session hi-tech interior — full-bleed chamber. */
  chamberBg: "/clicker/mine/mine_interior_hitech_v1.webp",
  /**
   * 1080p chamber still with center mineral (registered only — not wired as `chamberBg`;
   * layout differs from ore plate / door-walk seam at x=640).
   */
  chamberInteriorMineral1080pV1: "/clicker/mine/mine_interior_hitech_mineral_1080p_v1.png",
  orePlate: MINE_ORE_PLATE.src,
  /** The plate's blue strip lights, recoloured hot orange (same framing): FEVER pulses only these. */
  feverLights: "/clicker/mine/mine_fever_lights.webp",
  coreOre: "/clicker/mine/mine_core_ore_click_v1.webp",
} as const
