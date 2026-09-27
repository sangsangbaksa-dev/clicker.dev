/**
 * Guardian art per region. Scene art is a 3D full-scene render (1680×944, background
 * included) that replaces the region backdrop; sprite art stands on the region's own
 * backdrop. Points are percentages of the art so the tap target stays on the body.
 */
export type GuardianArt = {
  regionId: string
  src: string
  kind: "scene" | "sprite"
  /** Kept in view when a narrow screen crops the scene. */
  focus: { x: number; y: number }
  /** Tap target: body ellipse center and radius (x/y/r in % of the art width). */
  body: { x: number; y: number; r: number }
  accent: string
}

export const GUARDIAN_ART: GuardianArt[] = [
  {
    regionId: "signal_relay",
    src: "/clicker/monster/monster_signal_relay.webp",
    kind: "scene",
    focus: { x: 50, y: 40 },
    body: { x: 50, y: 42, r: 20 },
    accent: "#5dffa8",
  },
  {
    regionId: "phase_vault",
    src: "/clicker/monster/monster_phase_vault.svg",
    kind: "sprite",
    focus: { x: 50, y: 50 },
    body: { x: 50, y: 50, r: 50 },
    accent: "#c77dff",
  },
  {
    regionId: "storm_spire",
    src: "/clicker/monster/monster_storm_spire.webp",
    kind: "scene",
    focus: { x: 36, y: 45 },
    body: { x: 34, y: 44, r: 17 },
    accent: "#8fc8ff",
  },
  {
    regionId: "deep_fault",
    src: "/clicker/monster/monster_deep_fault.webp",
    kind: "scene",
    focus: { x: 50, y: 48 },
    body: { x: 50, y: 48, r: 18 },
    accent: "#ff7a3c",
  },
  {
    regionId: "drone_foundry",
    src: "/clicker/monster/monster_drone_foundry.webp",
    kind: "scene",
    focus: { x: 50, y: 42 },
    body: { x: 50, y: 42, r: 18 },
    accent: "#ffae4a",
  },
]

export function guardianArt(regionId: string | undefined): GuardianArt | undefined {
  return regionId ? GUARDIAN_ART.find((a) => a.regionId === regionId) : undefined
}
