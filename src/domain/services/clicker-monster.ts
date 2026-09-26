/**
 * Monster Hunt field challenge — pure simulation (no DOM). One ore-armored monster per
 * region; the player holds a laser on it to burn through the armor plates and HP.
 * Coordinates are field units: 1000×600 on wide screens, 600×900 on phones held upright.
 * The laser emitter sits at the bottom centre; movement paths scale to the field.
 */

export type MonsterKind = "specter" | "golem"

export type MonsterDef = {
  kind: MonsterKind
  name: string
  hp: number
  /** Ore plates covering the body; each one breaks at an even HP step. */
  plates: number
  /** Laser damage multiplier while any plate is still on. */
  armorFactor: number
  /** Kills for a perfect score in the challenge's time. */
  killTarget: number
  /** Half-extents of the hit ellipse around the body centre. */
  hitRx: number
  hitRy: number
}

export const MONSTERS: Record<MonsterKind, MonsterDef> = {
  specter: { kind: "specter", name: "잔향 해파리", hp: 100, plates: 6, armorFactor: 0.75, killTarget: 5, hitRx: 95, hitRy: 105 },
  golem: { kind: "golem", name: "위상 골렘", hp: 150, plates: 8, armorFactor: 0.7, killTarget: 4, hitRx: 115, hitRy: 150 },
}

export type Field = { w: number; h: number }
export const LANDSCAPE: Field = { w: 1000, h: 600 }
export const PORTRAIT: Field = { w: 600, h: 900 }

export const emitterOf = (field: Field) => ({ x: field.w / 2, y: field.h + 10 })
export const floorOf = (field: Field) => field.h - 52

export const LASER_DPS = 60
/** Below this share of HP the monster enrages: faster, redder. */
export const ENRAGE_AT = 0.35
/** No laser for this long → the monster starts knitting itself back together. */
export const REGEN_DELAY_S = 0.9
export const REGEN_PER_S = 12
export const SPAWN_S = 0.7
export const DEATH_S = 0.75

export type HuntPhase = "spawn" | "alive" | "dying"

export type HuntState = {
  phase: HuntPhase
  /** Seconds spent in the current phase. */
  phaseT: number
  hp: number
  platesBroken: number
  kills: number
  /** Movement clock — runs faster while enraged, pauses while dying. */
  pathT: number
  /** Seconds since the laser last touched the monster. */
  sinceHit: number
  /** Seconds the laser has been on the monster in this contact (flinch, glow ramp). */
  burnT: number
}

export type HuntEvent = "plate" | "kill" | "spawned" | "enrage"

export function createHunt(def: MonsterDef): HuntState {
  return { phase: "spawn", phaseT: 0, hp: def.hp, platesBroken: 0, kills: 0, pathT: 0, sinceHit: 99, burnT: 0 }
}

export function isEnraged(def: MonsterDef, s: HuntState): boolean {
  return s.phase === "alive" && s.hp / def.hp <= ENRAGE_AT
}

/** Plates that must be gone at this HP: plate k breaks at hp ≤ max·(1 − k/(plates+1)). */
export function platesBrokenAt(def: MonsterDef, hp: number): number {
  const lost = 1 - Math.max(0, hp) / def.hp
  return Math.min(def.plates, Math.floor(lost * (def.plates + 1) + 1e-9))
}

/** 0..1 how cracked the next plate is — drives the crack overlay before it pops. */
export function nextPlateCrack(def: MonsterDef, s: HuntState): number {
  if (s.platesBroken >= def.plates) return 0
  const step = 1 / (def.plates + 1)
  const lost = 1 - s.hp / def.hp
  return Math.max(0, Math.min(1, (lost - s.platesBroken * step) / step))
}

/** Body centre along the monster's path at movement time `t` (seconds). */
export function monsterPosition(
  kind: MonsterKind,
  t: number,
  field: Field = LANDSCAPE,
): { x: number; y: number; facing: 1 | -1 } {
  if (kind === "specter") {
    // Figure-eight drift with a slow bob — hard to keep a beam on without tracking it.
    const ampX = field.w / 2 - MONSTERS.specter.hitRx - 60
    const x = field.w / 2 + Math.sin(t * 0.55) * ampX * 0.88 + Math.sin(t * 1.7) * ampX * 0.12
    const y = field.h * 0.42 + Math.sin(t * 1.1) * field.h * 0.15 + Math.sin(t * 2.3) * 14
    return { x, y, facing: Math.cos(t * 0.55) >= 0 ? 1 : -1 }
  }
  // Golem paces the floor: a triangle wave in x, turning at the walls.
  const span = Math.min(560, field.w - 2 * MONSTERS.golem.hitRx - 80)
  const period = 9
  const phase = (t % period) / period
  const tri = phase < 0.5 ? phase * 2 : 2 - phase * 2
  const x = field.w / 2 - span / 2 + tri * span
  return { x, y: field.h - 240, facing: phase < 0.5 ? 1 : -1 }
}

export function hitsMonster(
  def: MonsterDef,
  s: HuntState,
  point: { x: number; y: number },
  field: Field = LANDSCAPE,
): boolean {
  if (s.phase !== "alive") return false
  const c = monsterPosition(def.kind, s.pathT, field)
  const dx = (point.x - c.x) / def.hitRx
  const dy = (point.y - c.y) / def.hitRy
  return dx * dx + dy * dy <= 1
}

/**
 * Advance the hunt by `dt` seconds. `burning` = the laser is on and touching the monster.
 * Returns the new state plus what happened, for sound and particles.
 */
export function stepHunt(def: MonsterDef, s: HuntState, dt: number, burning: boolean): { state: HuntState; events: HuntEvent[] } {
  const events: HuntEvent[] = []
  let next: HuntState = { ...s, phaseT: s.phaseT + dt }

  if (s.phase === "spawn") {
    if (next.phaseT >= SPAWN_S) {
      next = { ...next, phase: "alive", phaseT: 0 }
      events.push("spawned")
    }
    return { state: next, events }
  }

  if (s.phase === "dying") {
    if (next.phaseT >= DEATH_S) {
      next = { ...createHunt(def), kills: s.kills, pathT: s.pathT + 3.7 }
    }
    return { state: next, events }
  }

  const wasEnraged = isEnraged(def, s)
  next.pathT = s.pathT + dt * (wasEnraged ? 1.6 : 1)
  if (burning) {
    const armored = s.platesBroken < def.plates
    next.hp = Math.max(0, s.hp - LASER_DPS * (armored ? def.armorFactor : 1) * dt)
    next.sinceHit = 0
    next.burnT = s.burnT + dt
  } else {
    next.sinceHit = s.sinceHit + dt
    next.burnT = 0
    if (next.sinceHit > REGEN_DELAY_S) next.hp = Math.min(def.hp, s.hp + REGEN_PER_S * dt)
  }
  // Plates never grow back, even if HP regenerates past their step.
  const broken = Math.max(s.platesBroken, platesBrokenAt(def, next.hp))
  for (let i = s.platesBroken; i < broken; i++) events.push("plate")
  next.platesBroken = broken
  if (!wasEnraged && isEnraged(def, next)) events.push("enrage")

  if (next.hp <= 0) {
    next = { ...next, phase: "dying", phaseT: 0, hp: 0, kills: s.kills + 1, burnT: 0 }
    events.push("kill")
  }
  return { state: next, events }
}

/** Challenge score 0..1: kills plus the damage on the current monster, against the target. */
export function huntScore(def: MonsterDef, s: HuntState): number {
  const partial = s.phase === "alive" ? 1 - s.hp / def.hp : 0
  return Math.min(1, (s.kills + partial) / def.killTarget)
}
