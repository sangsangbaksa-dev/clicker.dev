/**
 * Signal Relay field challenge "잔향 사냥": monsters surface on a fixed schedule, each tap deals
 * one damage, and a monster escapes when its time runs out. The score is damage dealt over the
 * HP of every monster shown so far (plus half a point per stray tap), so quitting early or
 * letting monsters slip away both cost the same thing: the HP left on the table.
 */

export type MonsterKind = "drone" | "wraith" | "brute"

export type MonsterDef = {
  kind: MonsterKind
  name: string
  hp: number
  /** Escapes this long after surfacing. */
  lifeMs: number
  /** Relative spawn weight. */
  weight: number
  /** Drift across the field, fraction of its width per second (0 = hovers in place). */
  speed: number
}

export const MONSTERS: Record<MonsterKind, MonsterDef> = {
  drone: { kind: "drone", name: "신호 드론", hp: 2, lifeMs: 2400, weight: 6, speed: 0 },
  wraith: { kind: "wraith", name: "잔향 망령", hp: 4, lifeMs: 3200, weight: 3, speed: 0.1 },
  brute: { kind: "brute", name: "중계 파수꾼", hp: 9, lifeMs: 5000, weight: 1, speed: 0.03 },
}

export const HUNT_FIRST_MS = 300
export const HUNT_EVERY_MS = 800
/** A stray tap (nothing hit) costs this much HP worth of score. */
export const HUNT_MISS_WEIGHT = 0.5
/** Last share of a monster's life spent blinking before it escapes. */
export const HUNT_FLEE_SHARE = 0.3

/** Spawn area as field fractions, so sprites and HP bars never clip the frame. */
export const HUNT_BAND = { x0: 0.12, x1: 0.88, y0: 0.2, y1: 0.78 }
/** Preferred spacing between centres (field fractions, y weighted for a wide field). */
const MIN_GAP = 0.24

export type HuntSpawn = {
  id: number
  kind: MonsterKind
  spawnAt: number
  /** Centre when it surfaces, as field fractions. */
  x: number
  y: number
  dir: 1 | -1
}

/** Weighted pick; `roll` in [0, 1). */
export function pickMonster(roll: number): MonsterKind {
  const kinds = Object.values(MONSTERS)
  const total = kinds.reduce((sum, m) => sum + m.weight, 0)
  let acc = 0
  for (const m of kinds) {
    acc += m.weight / total
    if (roll < acc) return m.kind
  }
  return kinds[kinds.length - 1].kind
}

/** Horizontal position `ms` after surfacing: drifts and bounces off the band edges. */
export function huntX(spawn: HuntSpawn, ms: number): number {
  const speed = MONSTERS[spawn.kind].speed
  if (!speed) return spawn.x
  const x0 = HUNT_BAND.x0
  const span = HUNT_BAND.x1 - x0
  // Unfold the bounce: travel along a 2*span loop, then fold back into the band.
  const travelled = spawn.x - x0 + spawn.dir * speed * (Math.max(0, ms) / 1000)
  const loop = ((travelled % (2 * span)) + 2 * span) % (2 * span)
  return x0 + (loop <= span ? loop : 2 * span - loop)
}

/**
 * Every monster for one run. Only monsters whose whole life fits inside the run are scheduled,
 * so none can surface too late to be killed. Each picks the free spot farthest from the
 * monsters still on the field (best of a few rolls).
 */
export function buildHuntSchedule(durationMs: number, random: () => number = Math.random): HuntSpawn[] {
  const out: HuntSpawn[] = []
  for (let at = HUNT_FIRST_MS; at < durationMs; at += HUNT_EVERY_MS) {
    const kind = pickMonster(random())
    if (at + MONSTERS[kind].lifeMs > durationMs) continue
    const alive = out.filter((s) => at < s.spawnAt + MONSTERS[s.kind].lifeMs)
    let best = { x: 0.5, y: 0.5, gap: -1 }
    for (let i = 0; i < 8; i++) {
      const x = HUNT_BAND.x0 + random() * (HUNT_BAND.x1 - HUNT_BAND.x0)
      const y = HUNT_BAND.y0 + random() * (HUNT_BAND.y1 - HUNT_BAND.y0)
      const gap = alive.length
        ? Math.min(...alive.map((s) => Math.hypot(huntX(s, at - s.spawnAt) - x, (s.y - y) * 1.4)))
        : 1
      if (gap > best.gap) best = { x, y, gap }
      if (gap >= MIN_GAP) break
    }
    out.push({ id: out.length, kind, spawnAt: at, x: best.x, y: best.y, dir: random() < 0.5 ? 1 : -1 })
  }
  return out
}

/** Total HP of the monsters that have surfaced by `elapsed` — the most damage possible so far. */
export function huntPresentedHp(schedule: readonly HuntSpawn[], elapsed: number): number {
  let hp = 0
  for (const s of schedule) if (s.spawnAt <= elapsed) hp += MONSTERS[s.kind].hp
  return hp
}

/** 0..1: damage over the HP shown so far, with stray taps counted against it. */
export function huntScore(damage: number, presentedHp: number, misses: number): number {
  const tries = presentedHp + misses * HUNT_MISS_WEIGHT
  if (tries <= 0) return 0
  return Math.min(1, Math.min(damage, presentedHp) / tries)
}
