/** Mine chamber art pack — paths only; Waldomage + Waldo handoff. Palette PROVISIONAL. */

/** Interior with the single big center crystal — the clickable mining target. */
export const MINE_ORE_PLATE = {
  src: "/clicker/mine/mine_interior_mineral_ore_v2.png",
  width: 1280,
  height: 720,
  /** Crystal bounds inside the plate (px); holds the whole outline below. */
  ore: { x: 482, y: 212, w: 326, h: 316 },
  /**
   * Silhouette of the crystal cluster and its rock base, in plate px.
   * Traced from the art: this is the ore's exact hit area, so taps on the wall or floor miss.
   */
  outline: [
    [718, 524], [645, 524], [642, 520], [613, 520], [604, 516], [564, 510], [552, 512], [542, 502],
    [530, 496], [520, 496], [516, 492], [511, 496], [496, 481], [496, 472], [506, 453], [508, 441],
    [484, 413], [495, 400], [508, 402], [515, 408], [530, 397], [522, 389], [526, 385], [522, 377],
    [510, 366], [516, 355], [502, 326], [500, 294], [505, 286], [536, 307], [560, 346], [569, 340],
    [579, 346], [584, 341], [584, 336], [594, 316], [607, 336], [612, 331], [616, 295], [632, 278],
    [650, 306], [658, 297], [678, 248], [714, 218], [718, 221], [726, 258], [718, 289], [726, 300],
    [722, 315], [727, 320], [744, 302], [754, 298], [758, 303], [760, 322], [744, 353], [746, 363],
    [740, 378], [753, 388], [766, 375], [764, 371], [769, 366], [773, 364], [779, 370], [792, 362],
    [800, 370], [800, 375], [804, 379], [796, 386], [794, 396], [784, 406], [788, 410], [768, 433],
    [780, 446], [780, 452], [768, 473], [770, 476], [756, 494], [730, 506], [711, 508], [704, 515],
    [710, 522], [715, 520],
  ] as ReadonlyArray<readonly [number, number]>,
} as const

export const MineArt = {
  /** Hub pre-enter closed door; identical to door-walk v11 f000 so the entry video starts seamlessly. */
  entranceGate: "/clicker/mine/mine_entrance_hub_closed_door_v1.png",
  /** Door-walk v11 entry cinematic (1280×720, with SFX); ends on the ore plate. */
  enterCinematic: "/clicker/mine/mine_enter_door_walk_v11.mp4",
  /** Timed-session hi-tech interior — full-bleed chamber. */
  chamberBg: "/clicker/mine/mine_interior_hitech_v1.png",
  orePlate: MINE_ORE_PLATE.src,
  coreOre: "/clicker/mine/mine_core_ore_click_v1.png",
} as const
