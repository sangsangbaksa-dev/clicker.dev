/**
 * What occupies the region hub, and how a painted boss scene is framed.
 * Asset paths and cue synthesis stay outside this module.
 */

export type HubSurface = "mine" | "home" | "gate" | "guardian" | "hunt" | "drill" | "none"

export type HubSurfaceInput = {
  inMine: boolean
  isHome: boolean
  /** The arrival still is up and the player has not stepped into the activity. */
  atGate: boolean
  hasRegion: boolean
  hasBoss: boolean
  hasHunt: boolean
}

/**
 * One activity owns the hub. The closed gate hides it.
 * A region with neither a guardian nor a hunt drills its vein.
 */
export function hubSurface(input: HubSurfaceInput): HubSurface {
  if (input.inMine) return "mine"
  if (input.isHome) return "home"
  if (!input.hasRegion) return "none"
  if (input.atGate) return "gate"
  if (input.hasBoss) return "guardian"
  if (input.hasHunt) return "hunt"
  return "drill"
}

export type StagePoint = { x: number; y: number }
export type StageBody = StagePoint & { w: number; h: number }
export type BossWeather = "storm" | "crystal" | "lava" | "sanctum"
export type BossAttackCue = "dragonBreath" | "bossSmash" | "lavaBurst" | "wardenPulse"
export type BossHurtCue = "bossHurt" | "wardenHit"
export type BossSway = "wings" | "heave"

/** Portrait painting plus the wide cut it maps onto. Coordinates are percentages of the portrait. */
export type BossSceneDef = {
  src: string
  wide: { src: string; scale: number }
  body: StageBody
  eyes: StagePoint[]
  strike: StagePoint
  weather: BossWeather
  /** Space-separated rgb channels, consumed as rgb(var(--tint)). */
  tint: string
  attackSfx: BossAttackCue
  hurtSfx: BossHurtCue
  sway: BossSway
}

/** Portrait point placed on the wide cut (same height, centred). */
export function toWidePoint(point: StagePoint, scale: number): StagePoint {
  return { x: 50 + (point.x - 50) * scale, y: point.y }
}

/** Wide stages use the 16:9 cut. Tall stages keep the portrait painting. */
export function frameBossScene(scene: BossSceneDef, wide: boolean): BossSceneDef {
  if (!wide) return scene
  const scale = scene.wide.scale
  const body = toWidePoint(scene.body, scale)
  return {
    ...scene,
    src: scene.wide.src,
    body: { ...body, w: scene.body.w * scale, h: scene.body.h },
    eyes: scene.eyes.map((eye) => toWidePoint(eye, scale)),
    strike: toWidePoint(scene.strike, scale),
  }
}

/**
 * Camera line as a fraction of the painting. Eyes pull the frame;
 * a faceless guardian (no eyes) frames on the strike point instead.
 */
export function sceneCameraY(bodyY: number, eyeYs: number[], strikeY: number, belowEyes = 8): number {
  const eyeY = eyeYs.length > 0 ? eyeYs.reduce((sum, y) => sum + y, 0) / eyeYs.length : strikeY
  return Math.min(bodyY, eyeY + belowEyes) / 100
}

export type MoteMotion = {
  left: string
  duration: string
  delay: string
  drift: string
}

const MOTE_PACE: Record<BossWeather, { base: number; step: number }> = {
  storm: { base: 6, step: 0.4 },
  crystal: { base: 5.4, step: 0.7 },
  lava: { base: 2.4, step: 0.45 },
  sanctum: { base: 7.2, step: 0.85 },
}

/**
 * Per-mote timing and drift. CSS cannot take a remainder of a custom property,
 * so the spread is decided here and handed to the view as variables.
 */
export function weatherMotes(weather: BossWeather, count = 16): MoteMotion[] {
  const pace = MOTE_PACE[weather]
  const shift = weather === "sanctum" ? 8 : 4
  return Array.from({ length: count }, (_, i) => {
    const drift = ((i * 13) % 7) - 3
    return {
      left: `${(i * 17 + shift) % 94}%`,
      duration: `${pace.base + (i % 5) * pace.step}s`,
      delay: `${-i * 0.55}s`,
      drift: `${drift * 10}px`,
    }
  })
}

export type DrillMote = { left: string; delay: string }

/** Idle sparks rising off the drill bit. Positions are computed, not written as CSS remainder. */
export function drillMotes(count = 8): DrillMote[] {
  return Array.from({ length: count }, (_, i) => ({
    left: `${32 + ((i * 7) % 24)}%`,
    delay: `${-i * 0.35}s`,
  }))
}
