/**
 * Region guardians — 3D full-scene art (Canva, 1680×944) brought to life by `ClickerMonsterStage`.
 * All points are percentages of the art (x of width, y of height) so overlays stay pinned
 * to the painting at any crop.
 */

export type MonsterFx = "motes" | "signal" | "lightning" | "embers" | "sparks"

export type MonsterPoint = { x: number; y: number }

export type MonsterDef = {
  regionId: string
  name: string
  nameEn: string
  epithet: string
  /** Full scene, background included. */
  src: string
  /** Kept in view when a narrow screen crops the art. */
  focus: MonsterPoint
  /** Body ellipse that breathes separately from the background. */
  body: MonsterPoint & { r: number }
  eyes: MonsterPoint[]
  /** Where roars, shock rings and signal pulses start. */
  head: MonsterPoint
  /** Extra particle sources (welding torches, furnaces…). */
  emitters?: MonsterPoint[]
  accent: string
  fx: MonsterFx
  /** Mirror the art (points stay in the original art's coordinates) — keeps an off-center head clear of the side panel. */
  flip?: boolean
}

export const CLICKER_MONSTERS: MonsterDef[] = [
  {
    regionId: "core_chamber",
    name: "샤들링",
    nameEn: "SHARDLING",
    epithet: "코어 광맥을 지키는 결정 슬라임",
    src: "/clicker/monster/monster_core_chamber.webp",
    focus: { x: 44, y: 55 },
    body: { x: 45, y: 58, r: 22 },
    eyes: [
      { x: 36.9, y: 57.6 },
      { x: 46.7, y: 57.6 },
    ],
    head: { x: 42, y: 55 },
    emitters: [{ x: 50, y: 6 }],
    accent: "#5ff4ff",
    fx: "motes",
  },
  {
    regionId: "signal_relay",
    name: "에코 디바우러",
    nameEn: "ECHO DEVOURER",
    epithet: "중계탑의 신호를 삼키는 자",
    src: "/clicker/monster/monster_signal_relay.webp",
    focus: { x: 50, y: 40 },
    body: { x: 50, y: 48, r: 34 },
    eyes: [{ x: 47, y: 21.7 }],
    head: { x: 47, y: 21.7 },
    emitters: [
      { x: 13, y: 40 },
      { x: 86, y: 40 },
    ],
    accent: "#5dffa8",
    fx: "signal",
  },
  {
    regionId: "storm_spire",
    name: "볼트웜",
    nameEn: "VOLTWYRM",
    epithet: "첨탑을 휘감은 뇌룡",
    src: "/clicker/monster/monster_storm_spire.webp",
    focus: { x: 38, y: 45 },
    body: { x: 36, y: 44, r: 30 },
    eyes: [
      { x: 26.4, y: 45.8 },
      { x: 34.8, y: 42 },
    ],
    head: { x: 30, y: 46 },
    emitters: [{ x: 52, y: 8 }],
    accent: "#8fc8ff",
    fx: "lightning",
    flip: true,
  },
  {
    regionId: "deep_fault",
    name: "마그마 콜로서스",
    nameEn: "MAGMA COLOSSUS",
    epithet: "단층 깊은 곳의 용암 거신",
    src: "/clicker/monster/monster_deep_fault.webp",
    focus: { x: 50, y: 48 },
    body: { x: 50, y: 50, r: 30 },
    eyes: [
      { x: 47.4, y: 28.8 },
      { x: 50.2, y: 28.8 },
    ],
    head: { x: 48.8, y: 29 },
    accent: "#ff7a3c",
    fx: "embers",
  },
  {
    regionId: "drone_foundry",
    name: "브루드 매트리아크",
    nameEn: "BROOD MATRIARCH",
    epithet: "드론 군체를 낳는 기계 여왕",
    src: "/clicker/monster/monster_drone_foundry.webp",
    focus: { x: 50, y: 42 },
    body: { x: 50, y: 42, r: 32 },
    eyes: [
      { x: 44.5, y: 39.5 },
      { x: 54.5, y: 39.5 },
    ],
    head: { x: 49.5, y: 40 },
    emitters: [
      { x: 27.4, y: 20 },
      { x: 70.2, y: 19 },
      { x: 8, y: 82 },
      { x: 91, y: 82 },
      { x: 50, y: 92 },
    ],
    accent: "#ffae4a",
    fx: "sparks",
  },
]

export function monsterForRegion(regionId: string | undefined): MonsterDef | undefined {
  return regionId ? CLICKER_MONSTERS.find((m) => m.regionId === regionId) : undefined
}
