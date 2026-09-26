import type { MonsterArchetype, MonsterDef, RegionHuntDef } from "../entities/clicker.ts"

/**
 * Monster hunt: a pure, frame-stepped simulation the hunt screen renders.
 *
 * Coordinates are field fractions (0..1 on both axes, monster centers). Time is ms of fight
 * since the hunt opened. Every random choice goes through the `rng` argument so tests and the
 * playtime sim can replay a hunt exactly.
 *
 * The score is the share of the planned HP taken down (boss adds only fill gaps, overkill never
 * counts), scaled by the shields left: a flawless full clear is 1, a clear that lost every
 * shield but one is 0.8, and losing all shields ends the hunt early at 0.7 × damage share.
 */

export type Rng = () => number

export type HuntPhase = "intro" | "fight" | "break" | "won" | "lost" | "timeout"

export type HuntMonster = {
  uid: number
  defId: string
  name: string
  archetype: MonsterArchetype
  x: number
  y: number
  vx: number
  vy: number
  hp: number
  maxHp: number
  bornAt: number
  /** Elapsed ms when the telegraphed attack started, or -1. */
  chargeFrom: number
  chargeHits: number
  /** Next elapsed ms the monster starts an attack (casters, brutes, boss). */
  nextAttackAt: number
  /** Weak point open until this (brutes on a rhythm, anything after an interrupt). */
  weakUntil: number
  nextWeakAt: number
  stunUntil: number
  /** Swarmers pick a new heading at this time. */
  turnAt: number
  lastHitAt: number
  deadAt: number
  /** Boss HP thresholds (fractions) already used to call adds. */
  addsCalled: number
  /** Adds don't count toward the planned HP. */
  isAdd: boolean
}

export type HuntEventKind =
  | "hit"
  | "weak"
  | "crit"
  | "kill"
  | "boss_kill"
  | "interrupt"
  | "charge"
  | "shield"
  | "miss"
  | "wave"
  | "boss"
  | "adds"
  | "enrage"
  | "won"
  | "lost"
  | "timeout"

export type HuntEvent = {
  id: number
  kind: HuntEventKind
  at: number
  x: number
  y: number
  amount?: number
  uid?: number
}

export type HuntState = {
  phase: HuntPhase
  elapsed: number
  /** Fight clock starts after the intro; the limit applies to it. */
  fightStartedAt: number
  timeLimitMs: number
  /** Index into waves; `waves.length` is the boss wave. */
  wave: number
  waveCount: number
  breakUntil: number
  monsters: HuntMonster[]
  shields: number
  maxShields: number
  combo: number
  comboUntil: number
  bestCombo: number
  /** Damage that landed on planned HP (overkill and adds beyond the plan don't count). */
  damage: number
  plannedHp: number
  kills: number
  bossDown: boolean
  strikes: number
  misses: number
  weakHits: number
  interrupts: number
  power: number
  critChance: number
  events: HuntEvent[]
  nextUid: number
  nextEventId: number
  endedAt: number
}

/** Monster size (field fraction of the short side) — shared with the renderer for hit areas. */
export const MONSTER_SIZE: Record<MonsterArchetype, number> = {
  SWARMER: 0.13,
  CASTER: 0.17,
  BRUTE: 0.25,
  BOSS: 0.4,
}

export const HUNT_INTRO_MS = 2400
export const HUNT_WAVE_BREAK_MS = 1100
export const HUNT_BOSS_BREAK_MS = 1900
export const HUNT_MAX_SHIELDS = 3
export const HUNT_COMBO_WINDOW_MS = 1300
/** Each combo step adds this to damage, up to HUNT_COMBO_CAP steps. */
export const HUNT_COMBO_STEP = 0.025
export const HUNT_COMBO_CAP = 20
export const HUNT_WEAK_MULT = 3
export const HUNT_CRIT_MULT = 2
export const HUNT_STUN_MULT = 1.5
export const HUNT_STUN_MS = 1500

type AttackSpec = { every: [number, number]; charge: number; interruptHits: number }

/** Telegraphed attacks: time between attacks, telegraph length, strikes needed to interrupt. */
export const HUNT_ATTACKS: Partial<Record<MonsterArchetype, AttackSpec>> = {
  CASTER: { every: [3400, 5000], charge: 1800, interruptHits: 3 },
  BRUTE: { every: [6000, 7500], charge: 2200, interruptHits: 5 },
  BOSS: { every: [4400, 5400], charge: 2400, interruptHits: 7 },
}

/** Brutes (and the boss) open their weak point for `open` ms every `every` ms. */
const WEAK_RHYTHM: Partial<Record<MonsterArchetype, { every: number; open: number }>> = {
  BRUTE: { every: 3000, open: 1400 },
  BOSS: { every: 4200, open: 1200 },
}

const SPEED: Record<MonsterArchetype, number> = {
  SWARMER: 0.22,
  CASTER: 0.07,
  BRUTE: 0.045,
  BOSS: 0.06,
}

/** Keep sprites clear of the HUD strip at the top and the laser rig at the bottom. */
const FIELD_TOP = 0.1
const FIELD_BOTTOM = 0.86

const EVENT_TTL_MS = 1600

/** Hunter strength: +20% per walked worldline, crit chance from the run (capped). */
export function huntPower(rebirthCount: number): number {
  return 1 + 0.2 * Math.max(0, rebirthCount)
}

export function huntCritChance(runCritChance: number): number {
  return Math.min(0.3, Math.max(0, runCritChance))
}

function between(rng: Rng, [lo, hi]: [number, number]): number {
  return lo + (hi - lo) * rng()
}

function margin(archetype: MonsterArchetype): number {
  return MONSTER_SIZE[archetype] / 2
}

function bounds(archetype: MonsterArchetype) {
  const m = margin(archetype)
  return { x0: m, x1: 1 - m, y0: FIELD_TOP + m * 0.8, y1: FIELD_BOTTOM - m * 0.8 }
}

export function plannedHuntHp(def: RegionHuntDef, monsters: MonsterDef[]): number {
  const hp = (id: string) => monsters.find((m) => m.id === id)?.hp ?? 0
  return def.waves.flat().reduce((sum, id) => sum + hp(id), 0) + hp(def.boss)
}

function pushEvent(state: HuntState, event: Omit<HuntEvent, "id" | "at">): void {
  state.events.push({ ...event, id: state.nextEventId++, at: state.elapsed })
}

function spawnMonster(
  state: HuntState,
  def: MonsterDef,
  rng: Rng,
  at: { x: number; y: number } | null,
  delay: number,
  isAdd = false,
): HuntMonster {
  const b = bounds(def.archetype)
  const x = at ? Math.min(b.x1, Math.max(b.x0, at.x)) : b.x0 + (b.x1 - b.x0) * rng()
  const y =
    def.archetype === "BOSS"
      ? FIELD_TOP + 0.3
      : at
        ? Math.min(b.y1, Math.max(b.y0, at.y))
        : b.y0 + (b.y1 - b.y0) * rng()
  const angle = rng() * Math.PI * 2
  const speed = SPEED[def.archetype]
  const attack = HUNT_ATTACKS[def.archetype]
  const weak = WEAK_RHYTHM[def.archetype]
  const bornAt = state.elapsed + delay
  return {
    uid: state.nextUid++,
    defId: def.id,
    name: def.name,
    archetype: def.archetype,
    x,
    y,
    vx: def.archetype === "BOSS" ? speed * (rng() < 0.5 ? -1 : 1) : Math.cos(angle) * speed,
    vy: def.archetype === "BOSS" ? 0 : Math.sin(angle) * speed,
    hp: def.hp,
    maxHp: def.hp,
    bornAt,
    chargeFrom: -1,
    chargeHits: 0,
    // First attack comes a little later than the rhythm so a wave never opens with a hit.
    nextAttackAt: attack ? bornAt + between(rng, attack.every) * 0.8 + 600 : Infinity,
    weakUntil: 0,
    nextWeakAt: weak ? bornAt + weak.every * (0.4 + rng() * 0.4) : Infinity,
    stunUntil: 0,
    turnAt: bornAt + 400 + rng() * 800,
    lastHitAt: -Infinity,
    deadAt: -1,
    addsCalled: 0,
    isAdd,
  }
}

function spawnWave(state: HuntState, def: RegionHuntDef, monsters: MonsterDef[], rng: Rng): void {
  const ids = state.wave < def.waves.length ? def.waves[state.wave] : [def.boss]
  // Spread spawns across columns so a wave doesn't open stacked on one spot.
  const slots = ids.map((_, i) => (i + 0.5) / ids.length)
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[slots[i], slots[j]] = [slots[j], slots[i]]
  }
  ids.forEach((id, i) => {
    const m = monsters.find((d) => d.id === id)
    if (!m) return
    const b = bounds(m.archetype)
    const x = b.x0 + (b.x1 - b.x0) * slots[i]
    const y = b.y0 + (b.y1 - b.y0) * (0.15 + rng() * 0.7)
    state.monsters.push(spawnMonster(state, m, rng, { x, y }, i * 160))
  })
  const boss = state.wave >= def.waves.length
  pushEvent(state, { kind: boss ? "boss" : "wave", x: 0.5, y: 0.4, amount: state.wave + 1 })
}

export function createHunt(
  def: RegionHuntDef,
  monsters: MonsterDef[],
  opts: { power: number; critChance: number },
): HuntState {
  return {
    phase: "intro",
    elapsed: 0,
    fightStartedAt: HUNT_INTRO_MS,
    timeLimitMs: def.timeLimitSec * 1000,
    wave: 0,
    waveCount: def.waves.length + 1,
    breakUntil: 0,
    monsters: [],
    shields: HUNT_MAX_SHIELDS,
    maxShields: HUNT_MAX_SHIELDS,
    combo: 0,
    comboUntil: 0,
    bestCombo: 0,
    damage: 0,
    plannedHp: plannedHuntHp(def, monsters),
    kills: 0,
    bossDown: false,
    strikes: 0,
    misses: 0,
    weakHits: 0,
    interrupts: 0,
    power: Math.max(0.1, opts.power),
    critChance: huntCritChance(opts.critChance),
    events: [],
    nextUid: 1,
    nextEventId: 1,
    endedAt: -1,
  }
}

export function isHuntOver(state: HuntState): boolean {
  return state.phase === "won" || state.phase === "lost" || state.phase === "timeout"
}

export function isMonsterAlive(m: HuntMonster, elapsed: number): boolean {
  return m.deadAt < 0 && m.bornAt <= elapsed
}

/** Share of the fight clock left (1 → 0). */
export function huntTimeLeftMs(state: HuntState): number {
  if (state.phase === "intro") return state.timeLimitMs
  const end = state.endedAt >= 0 ? state.endedAt : state.elapsed
  return Math.max(0, state.timeLimitMs - (end - state.fightStartedAt))
}

export function huntScore(state: HuntState): number {
  if (state.plannedHp <= 0) return 0
  const share = Math.min(1, state.damage / state.plannedHp)
  return share * (0.7 + 0.3 * (state.shields / state.maxShields))
}

function clone(state: HuntState): HuntState {
  return { ...state, monsters: state.monsters.map((m) => ({ ...m })), events: [...state.events] }
}

function end(state: HuntState, phase: "won" | "lost" | "timeout"): void {
  state.phase = phase
  state.endedAt = state.elapsed
  for (const m of state.monsters) m.chargeFrom = -1
  pushEvent(state, { kind: phase, x: 0.5, y: 0.45 })
}

/** Advance the hunt by `dt` ms. */
export function stepHunt(
  prev: HuntState,
  dt: number,
  def: RegionHuntDef,
  monsters: MonsterDef[],
  rng: Rng,
): HuntState {
  if (isHuntOver(prev) || dt <= 0) return prev
  const state = clone(prev)
  // Large frame gaps (tab switch) are clipped so monsters don't teleport or double-attack.
  const step = Math.min(dt, 100)
  state.elapsed += step
  const t = state.elapsed
  state.events = state.events.filter((e) => t - e.at < EVENT_TTL_MS)

  if (state.phase === "intro") {
    if (t >= state.fightStartedAt) {
      state.phase = "fight"
      spawnWave(state, def, monsters, rng)
    }
    return state
  }

  if (t - state.fightStartedAt >= state.timeLimitMs) {
    end(state, "timeout")
    return state
  }

  if (state.combo > 0 && t > state.comboUntil) state.combo = 0

  if (state.phase === "break") {
    if (t >= state.breakUntil) {
      state.phase = "fight"
      spawnWave(state, def, monsters, rng)
    }
    return state
  }

  const secs = step / 1000
  for (const m of state.monsters) {
    if (!isMonsterAlive(m, t)) continue
    const stunned = m.stunUntil > t
    const attack = HUNT_ATTACKS[m.archetype]
    const weak = WEAK_RHYTHM[m.archetype]
    const enraged = m.archetype === "BOSS" && m.hp <= m.maxHp / 3

    // Movement (frozen while stunned or winding up a heavy attack).
    if (!stunned && !(m.chargeFrom >= 0 && m.archetype !== "SWARMER")) {
      if (m.archetype === "SWARMER" && t >= m.turnAt) {
        const angle = rng() * Math.PI * 2
        const speed = SPEED.SWARMER * (0.8 + rng() * 0.5)
        m.vx = Math.cos(angle) * speed
        m.vy = Math.sin(angle) * speed
        m.turnAt = t + 500 + rng() * 900
      }
      // Knocked-back swarmers ease back to cruising speed.
      if (m.archetype === "SWARMER") {
        const sp = Math.hypot(m.vx, m.vy)
        const cruise = SPEED.SWARMER * 1.1
        if (sp > cruise) {
          const k = Math.max(cruise / sp, 1 - secs * 3)
          m.vx *= k
          m.vy *= k
        }
      }
      const mult = enraged ? 1.7 : 1
      m.x += m.vx * secs * mult
      m.y += m.vy * secs * mult
      const b = bounds(m.archetype)
      if (m.x < b.x0 || m.x > b.x1) {
        m.vx = -m.vx
        m.x = Math.min(b.x1, Math.max(b.x0, m.x))
      }
      if (m.y < b.y0 || m.y > b.y1) {
        m.vy = -m.vy
        m.y = Math.min(b.y1, Math.max(b.y0, m.y))
      }
    }

    // Weak point rhythm.
    if (weak && t >= m.nextWeakAt) {
      m.weakUntil = Math.max(m.weakUntil, t + weak.open)
      m.nextWeakAt = t + weak.every
    }

    // Telegraphed attacks.
    if (attack && !stunned) {
      if (m.chargeFrom < 0 && t >= m.nextAttackAt) {
        m.chargeFrom = t
        m.chargeHits = 0
        pushEvent(state, { kind: "charge", x: m.x, y: m.y, uid: m.uid })
      } else if (m.chargeFrom >= 0 && t - m.chargeFrom >= attack.charge * (enraged ? 0.8 : 1)) {
        m.chargeFrom = -1
        m.nextAttackAt = t + between(rng, attack.every) * (enraged ? 0.75 : 1)
        state.shields = Math.max(0, state.shields - 1)
        state.combo = 0
        pushEvent(state, { kind: "shield", x: m.x, y: m.y, uid: m.uid })
        if (state.shields <= 0) {
          end(state, "lost")
          return state
        }
      }
    }
  }

  // Dead sprites linger briefly for the death animation, then leave the list.
  state.monsters = state.monsters.filter((m) => m.deadAt < 0 || t - m.deadAt < 900)

  const alive = state.monsters.some((m) => m.deadAt < 0)
  if (!alive) {
    if (state.wave >= def.waves.length) {
      end(state, "won")
    } else {
      state.wave += 1
      state.phase = "break"
      state.breakUntil = t + (state.wave >= def.waves.length ? HUNT_BOSS_BREAK_MS : HUNT_WAVE_BREAK_MS)
    }
  }
  return state
}

/** Damage a single strike would deal right now (before the crit roll). */
export function strikeDamage(state: HuntState, m: HuntMonster, weak: boolean, crit: boolean): number {
  // The combo counts this strike too; the bonus starts from the second strike in a chain.
  const combo = 1 + Math.min(Math.max(0, state.combo - 1), HUNT_COMBO_CAP) * HUNT_COMBO_STEP
  return (
    state.power *
    combo *
    (crit ? HUNT_CRIT_MULT : 1) *
    (weak ? HUNT_WEAK_MULT : 1) *
    (m.stunUntil > state.elapsed ? HUNT_STUN_MULT : 1)
  )
}

/**
 * Strike a monster. `onWeakPoint` is whether the tap landed on the weak-point spot; it only
 * counts while the weak point is open.
 */
export function strikeMonster(
  prev: HuntState,
  uid: number,
  onWeakPoint: boolean,
  def: RegionHuntDef,
  monsters: MonsterDef[],
  rng: Rng,
): HuntState {
  if (prev.phase !== "fight") return prev
  const target = prev.monsters.find((m) => m.uid === uid)
  if (!target || !isMonsterAlive(target, prev.elapsed)) return prev
  const state = clone(prev)
  const t = state.elapsed
  const m = state.monsters.find((x) => x.uid === uid)!
  const weak = onWeakPoint && m.weakUntil > t
  const crit = rng() < state.critChance
  state.combo = Math.min(state.combo + 1, 999)
  state.comboUntil = t + HUNT_COMBO_WINDOW_MS
  state.bestCombo = Math.max(state.bestCombo, state.combo)
  state.strikes += 1
  if (weak) state.weakHits += 1

  const dmg = strikeDamage(state, m, weak, crit)
  const landed = Math.min(m.hp, dmg)
  m.hp -= landed
  m.lastHitAt = t
  if (!m.isAdd) state.damage += landed
  else {
    // Adds pay into planned HP the player may have missed elsewhere, never past the plan.
    state.damage = Math.min(state.plannedHp, state.damage + landed * 0.5)
  }
  pushEvent(state, { kind: weak ? "weak" : crit ? "crit" : "hit", x: m.x, y: m.y, amount: dmg, uid: m.uid })

  // Interrupt a telegraphed attack; weak-point hits count double.
  const attack = HUNT_ATTACKS[m.archetype]
  if (attack && m.chargeFrom >= 0 && m.hp > 0) {
    m.chargeHits += weak ? 2 : 1
    if (m.chargeHits >= attack.interruptHits) {
      m.chargeFrom = -1
      m.chargeHits = 0
      m.stunUntil = t + HUNT_STUN_MS
      m.weakUntil = Math.max(m.weakUntil, t + HUNT_STUN_MS)
      m.nextAttackAt = t + HUNT_STUN_MS + between(rng, attack.every)
      state.interrupts += 1
      pushEvent(state, { kind: "interrupt", x: m.x, y: m.y, uid: m.uid })
    }
  }

  // Swarmers dart away from the laser.
  if (m.archetype === "SWARMER" && m.hp > 0) {
    const angle = rng() * Math.PI * 2
    m.vx = Math.cos(angle) * SPEED.SWARMER * 2.6
    m.vy = Math.sin(angle) * SPEED.SWARMER * 2.6
    m.turnAt = t + 450
  }

  // Boss calls in swarmers at 2/3 and 1/3 HP, and enrages at 1/3.
  if (m.archetype === "BOSS" && m.hp > 0) {
    const thresholds = [2 / 3, 1 / 3]
    while (m.addsCalled < thresholds.length && m.hp <= m.maxHp * thresholds[m.addsCalled]) {
      m.addsCalled += 1
      const add = monsters.find((d) => d.id === def.bossAdd)
      if (add) {
        for (const side of [-1, 1]) {
          state.monsters.push(spawnMonster(state, add, rng, { x: m.x + side * 0.22, y: m.y + 0.12 }, 250, true))
        }
        pushEvent(state, { kind: "adds", x: m.x, y: m.y, uid: m.uid })
      }
      if (m.addsCalled === 2) pushEvent(state, { kind: "enrage", x: m.x, y: m.y, uid: m.uid })
    }
  }

  if (m.hp <= 1e-9) {
    m.hp = 0
    m.deadAt = t
    m.chargeFrom = -1
    state.kills += 1
    if (m.archetype === "BOSS") {
      state.bossDown = true
      // The boss takes its adds down with it.
      for (const other of state.monsters) {
        if (other.isAdd && other.deadAt < 0) {
          other.deadAt = t
          other.hp = 0
          state.kills += 1
          pushEvent(state, { kind: "kill", x: other.x, y: other.y, uid: other.uid })
        }
      }
    }
    pushEvent(state, { kind: m.archetype === "BOSS" ? "boss_kill" : "kill", x: m.x, y: m.y, uid: m.uid })
  }
  return state
}

/** A strike that hit nothing: breaks the combo. */
export function strikeMiss(prev: HuntState, x: number, y: number): HuntState {
  if (prev.phase !== "fight") return prev
  const state = clone(prev)
  state.misses += 1
  state.combo = 0
  pushEvent(state, { kind: "miss", x, y })
  return state
}

/** Leave early: the hunt settles as a timeout with what was done so far. */
export function abandonHunt(prev: HuntState): HuntState {
  if (isHuntOver(prev)) return prev
  const state = clone(prev)
  end(state, "timeout")
  return state
}

export type HuntSummary = {
  score: number
  outcome: "won" | "lost" | "timeout"
  kills: number
  bossDown: boolean
  flawless: boolean
  damageShare: number
  bestCombo: number
  weakHits: number
  interrupts: number
  accuracy: number
  shields: number
}

export function summarizeHunt(state: HuntState): HuntSummary {
  const outcome = state.phase === "won" || state.phase === "lost" ? state.phase : "timeout"
  const total = state.strikes + state.misses
  return {
    score: huntScore(state),
    outcome,
    kills: state.kills,
    bossDown: state.bossDown,
    flawless: outcome === "won" && state.shields === state.maxShields,
    damageShare: state.plannedHp > 0 ? Math.min(1, state.damage / state.plannedHp) : 0,
    bestCombo: state.bestCombo,
    weakHits: state.weakHits,
    interrupts: state.interrupts,
    accuracy: total > 0 ? state.strikes / total : 0,
    shields: state.shields,
  }
}

/**
 * Scripted hunter for tests and the playtime sim: `tapsPerSec` taps, `accuracy` of them land.
 * Priorities: a charging monster once noticed (to interrupt), then an open weak point, then the
 * lowest HP.
 * `weakSkill` is the chance a tap on an open weak point actually lands on the spot.
 */
export function autoplayHunt(
  def: RegionHuntDef,
  monsters: MonsterDef[],
  opts: {
    power: number
    critChance: number
    tapsPerSec: number
    accuracy: number
    weakSkill?: number
    /** How long a telegraph shows before the hunter reacts to it (ms). */
    reactionMs?: number
  },
  rng: Rng,
): HuntState {
  let state = createHunt(def, monsters, opts)
  const frame = 1000 / 60
  const tapEvery = 1000 / opts.tapsPerSec
  let nextTap = HUNT_INTRO_MS
  const weakSkill = opts.weakSkill ?? 0.6
  const reaction = opts.reactionMs ?? 500
  for (let guard = 0; guard < 200_000 && !isHuntOver(state); guard++) {
    state = stepHunt(state, frame, def, monsters, rng)
    while (state.phase === "fight" && state.elapsed >= nextTap) {
      nextTap += tapEvery
      const live = state.monsters.filter((m) => isMonsterAlive(m, state.elapsed))
      if (!live.length) break
      const target =
        live.find((m) => m.chargeFrom >= 0 && state.elapsed - m.chargeFrom >= reaction) ??
        live.find((m) => m.weakUntil > state.elapsed) ??
        live.reduce((a, b) => (b.hp < a.hp ? b : a))
      if (rng() > opts.accuracy) {
        state = strikeMiss(state, target.x, target.y)
        continue
      }
      const weak = target.weakUntil > state.elapsed && rng() < weakSkill
      state = strikeMonster(state, target.uid, weak, def, monsters, rng)
    }
  }
  return state
}
