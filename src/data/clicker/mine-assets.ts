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
  /**
   * ORIGINAL plate (1920x1080 webp) with the BIG crystal baked in. It is no longer the background: it is only the
   * source the live (shrunk) crystal is cropped from, so the crystal keeps exactly the pixels it always had.
   */
  src: "/clicker/mine/mine_interior_mineral_ore_v2.webp",
  /**
   * CLEAN plate = the full-bleed background: same room, same 1920x1080 webp class, with the crystal, rubble and baked
   * contact shadow removed (Waldomage clean v1; the centre floor is a little brighter). Built by this patch's
   * apply-assets.sh (copied, not in the diff).
   */
  clean: "/clicker/mine/mine_interior_mineral_ore_clean_v1.webp",
  width: 1280,
  height: 720,
  /** Crystal bounds inside the ORIGINAL plate (px) — the BIG crystal baked into that picture. */
  ore: { x: 488, y: 208, w: 318, h: 324 },
  /**
   * Shrink to the mine-entry video's last frame (polish v1: hitech + a small ore). Measured on the decoded last
   * frame (1280x720 grid): the video's crystal is the plate's crystal x0.48, centre (643, 354.5) — silhouette
   * MAE 9.9 (unshrunk: 54.4). Only ever <= 1; the pure rule is `layoutOrePlate` (domain/services/clicker-ore-plate).
   */
  fit: { scale: 0.48, centerX: 643, centerY: 354.5 },
  /**
   * Soft ground shadow under the shrunk crystal (the clean plate has none and a bright, empty centre): an ellipse in
   * fractions of the shrunk ore box. The crystal's base sits at ~93 % of the box height, a little left of centre
   * (silhouette rows 90-97 %: x 18-74 % of the box width), so: centre (48 %, 93 %), half-axes 55 % x 10 % of the box.
   * `rgb` is the dark cyan core colour; `alpha` the peak opacity (fades to 0 at the rim, half at mid-radius).
   */
  shadow: { cx: 0.48, cy: 0.93, rx: 0.55, ry: 0.1, alpha: 0.5, rgb: [3, 14, 20] },
} as const

/** Quality ids of the mine-entry render (kept in sync with `CinematicQuality` in the domain). */
export type MineEnterQuality = "hq" | "mobile720"

/**
 * Mine-entry cinematic (Waldo "polish v1": cyan/teal only, 10 s, both renders carry the same AAC soundtrack).
 * `hq` = 1920x1080 @ 60 fps; `mobile720` = 1280x720 @ 30 fps for phones / data-saver (≈1.7 MB).
 * Copied from `clicker-artifacts` by scripts/mine-enter-polish-assets.sh.
 */
export const MINE_ENTER_VIDEOS = {
  hq: { src: "/clicker/mine/mine_enter_polish_v1_1080p.mp4", width: 1920, height: 1080, fps: 60, seconds: 10 },
  mobile720: { src: "/clicker/mine/mine_enter_polish_v1_720p.mp4", width: 1280, height: 720, fps: 30, seconds: 10 },
} as const satisfies Record<MineEnterQuality, { src: string; width: number; height: number; fps: number; seconds: number }>

/**
 * Frame 0 of the polish render (the v10 closed-door hub, door seam ~27 px right of the hub still `entranceGate`).
 * Used as the cinematic poster so the swap to the playing video is invisible; the hub -> poster step is the
 * overlay's own fade-in.
 */
export const MINE_ENTER_POSTER = "/clicker/mine/mine_enter_polish_v1_poster.webp"

/** Cross-fade from the held last frame into the mine (ms): the video ends on hitech interior + a small ore, the live plate has the big crystal. */
export const MINE_ENTER_HANDOFF_MS = 600

export function mineEnterVideo(quality: MineEnterQuality) {
  return MINE_ENTER_VIDEOS[quality]
}

export const MineArt = {
  /** Hub pre-enter closed door; matches door-walk f000 (seam x=640 @ 720p). */
  entranceGate: "/clicker/mine/mine_entrance_hub_closed_door_v2.webp",
  /** Same gate, cropped so the door's centre is the image centre (title screen). */
  titleGate: "/clicker/mine/title_door_centered.webp",
  /**
   * Entry cinematic, polish v1 (1920×1080 @ 60 fps, 10 s): closed hub door -> door opens -> walk in
   * to the hi-tech interior. 720p twin below for phones; poster = its own first frame.
   */
  enterCinematic: MINE_ENTER_VIDEOS.hq.src,
  enterCinematicMobile: MINE_ENTER_VIDEOS.mobile720.src,
  enterPoster: MINE_ENTER_POSTER,
  /** Previous cinematic (v17, scripts/clicker-mine-enter.py) — kept on disk for reference / rollback. */
  enterCinematicV17: "/clicker/mine/mine_enter_door_walk_v17.mp4",
  /** Previous 720p door-walk (kept on disk for reference). */
  enterCinematicV11: "/clicker/mine/mine_enter_door_walk_v11.mp4",
  /** Timed-session hi-tech interior — full-bleed chamber. */
  chamberBg: "/clicker/mine/mine_interior_hitech_v1.webp",
  /**
   * 1080p chamber still with center mineral (registered only — not wired as `chamberBg`;
   * layout differs from ore plate / door-walk seam at x=640).
   */
  chamberInteriorMineral1080pV1: "/clicker/mine/mine_interior_hitech_mineral_1080p_v1.png",
  /** Full-bleed mine background (the clean plate: no crystal baked in). */
  orePlate: MINE_ORE_PLATE.clean,
  /** Original plate with the big crystal — only the source of the live crystal's crop. */
  orePlateCrystal: MINE_ORE_PLATE.src,
  coreOre: "/clicker/mine/mine_core_ore_click_v1.webp",
} as const
