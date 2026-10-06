import type { BossSceneDef } from "../../domain/services/clicker-stage"

/**
 * Painted boss plates. Coordinates are percentages of the portrait cut.
 * Framing onto the wide cut, and which hub shows them, live in the domain.
 */
export const BOSS_SCENES: Record<string, BossSceneDef> = {
  stormbird: {
    src: "/clicker/boss/storm_spire.webp",
    wide: { src: "/clicker/boss/storm_spire_wide.webp", scale: 0.3748 },
    body: { x: 50, y: 30, w: 98, h: 56 },
    eyes: [{ x: 44.1, y: 23 }, { x: 52.6, y: 23 }],
    strike: { x: 48.8, y: 30 },
    weather: "storm",
    tint: "120 220 255",
    attackSfx: "dragonBreath",
    hurtSfx: "bossHurt",
    sway: "wings",
  },
  golem: {
    src: "/clicker/boss/phase_vault.webp",
    wide: { src: "/clicker/boss/phase_vault_wide.webp", scale: 0.3748 },
    body: { x: 52, y: 37, w: 94, h: 62 },
    eyes: [{ x: 49.5, y: 20.6 }, { x: 56.7, y: 21.1 }],
    strike: { x: 50, y: 80 },
    weather: "crystal",
    tint: "80 245 225",
    attackSfx: "bossSmash",
    hurtSfx: "bossHurt",
    sway: "heave",
  },
  worm: {
    src: "/clicker/boss/deep_fault.webp",
    wide: { src: "/clicker/boss/deep_fault_wide.webp", scale: 0.374 },
    body: { x: 52, y: 40, w: 80, h: 72 },
    eyes: [{ x: 45, y: 12 }, { x: 52, y: 12 }],
    strike: { x: 50, y: 82 },
    weather: "lava",
    tint: "255 130 40",
    attackSfx: "lavaBurst",
    hurtSfx: "bossHurt",
    sway: "heave",
  },
  /** Core Heart. The arrival still already paints the guardian into the sanctum. */
  warden: {
    src: "/clicker/region/core_heart_still.webp",
    wide: { src: "/clicker/region/core_heart_still.webp", scale: 1 },
    body: { x: 48, y: 42, w: 70, h: 78 },
    eyes: [],
    strike: { x: 44.8, y: 26.2 },
    weather: "sanctum",
    tint: "120 230 255",
    attackSfx: "wardenPulse",
    hurtSfx: "wardenHit",
    sway: "heave",
  },
}
