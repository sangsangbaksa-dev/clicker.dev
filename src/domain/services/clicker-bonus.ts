import type {
  AchievementDef,
  AchievementKind,
  EventBoost,
  EventBoostId,
  GameConfig,
  MetaState,
  RunState,
} from "../entities/clicker"

/**
 * Meta systems layered on the core loop: golden veins, achievements,
 * auto-drill, and bonus grants. Pure functions over state — the engine only
 * reads the multipliers, so this module never imports the engine.
 */

export type Rng = () => number

/* ---------- Golden vein ---------- */

/** Chance a golden vein appears during one mine session. */
export const VEIN_SPAWN_CHANCE = 0.45
/** How long a vein stays clickable (ms). */
export const VEIN_LIFETIME_MS = 3_500

export const VEIN_SURGE = { multiplier: 5, seconds: 60 } as const
/** ×8 (was ×50): one early rush used to be worth dozens of mine sessions and skipped the opening. */
export const VEIN_LASER_RUSH = { multiplier: 8, seconds: 8 } as const
/** Jackpot pays min(bank share, minutes of production) + a floor. */
export const VEIN_JACKPOT = { bankShare: 0.1, productionSeconds: 600, floor: 25 } as const

export type VeinOutcome =
  | { kind: "surge"; multiplier: number; seconds: number }
  | { kind: "jackpot"; energy: number }
  | { kind: "laser_rush"; multiplier: number; seconds: number }

/** 45% surge · 45% jackpot · 10% laser rush. */
export function rollVeinKind(rng: Rng): VeinOutcome["kind"] {
  const r = rng()
  if (r < 0.45) return "surge"
  if (r < 0.9) return "jackpot"
  return "laser_rush"
}

export function jackpotEnergy(coreEnergy: number, perSecond: number): number {
  const share = Math.max(0, coreEnergy) * VEIN_JACKPOT.bankShare
  const production = Math.max(0, perSecond) * VEIN_JACKPOT.productionSeconds
  return Math.min(share, production) + VEIN_JACKPOT.floor
}

function withBoost(run: RunState, boost: EventBoost): RunState {
  // Re-claiming the same kind refreshes it rather than stacking.
  return { ...run, eventBoosts: [...run.eventBoosts.filter((b) => b.id !== boost.id), boost] }
}

export function claimGoldenVein(
  run: RunState,
  meta: MetaState,
  perSecond: number,
  now: number,
  rng: Rng,
): { run: RunState; meta: MetaState; outcome: VeinOutcome } {
  const kind = rollVeinKind(rng)
  const stats = { ...meta.statistics, veins: meta.statistics.veins + 1 }
  if (kind === "jackpot") {
    const energy = jackpotEnergy(run.coreEnergy, perSecond)
    const granted = grantBonusEnergy(run, { ...meta, statistics: stats }, energy)
    return { ...granted, outcome: { kind, energy } }
  }
  const spec = kind === "surge" ? VEIN_SURGE : VEIN_LASER_RUSH
  return {
    run: withBoost(run, { id: kind, multiplier: spec.multiplier, expiresAt: now + spec.seconds * 1000 }),
    meta: { ...meta, statistics: stats },
    outcome: { kind, multiplier: spec.multiplier, seconds: spec.seconds },
  }
}

export function eventBoostMultiplier(run: RunState, id: EventBoostId, now: number): number {
  const boost = run.eventBoosts.find((b) => b.id === id && b.expiresAt > now)
  return boost?.multiplier ?? 1
}

export function pruneEventBoosts(run: RunState, now: number): RunState {
  if (run.eventBoosts.every((b) => b.expiresAt > now)) return run
  return { ...run, eventBoosts: run.eventBoosts.filter((b) => b.expiresAt > now) }
}

/* ---------- Mine ore ---------- */

export function recordOreBroken(meta: MetaState): MetaState {
  return { ...meta, statistics: { ...meta.statistics, oresBroken: meta.statistics.oresBroken + 1 } }
}

/* ---------- Achievements ---------- */

/** Each unlocked achievement adds this much production (additive, then applied once). */
export const ACHIEVEMENT_PRODUCTION_BONUS = 0.01

export function achievementProductionMultiplier(meta: MetaState): number {
  return 1 + meta.achievementIds.length * ACHIEVEMENT_PRODUCTION_BONUS
}

export function achievementProgress(kind: AchievementKind, run: RunState, meta: MetaState): number {
  const s = meta.statistics
  switch (kind) {
    case "CLICKS":
      return s.clicks
    case "CRITS":
      return s.crits
    case "COMBO":
      return s.maxCombo
    case "FEVERS":
      // meta only folds in the run's fever count at rebirth.
      return s.feverStarts + run.feverStarts
    case "LIFETIME":
      return meta.totalCoreEnergy
    case "PRODUCERS":
      return Object.values(run.producerLevels).reduce((sum, n) => sum + n, 0)
    case "SKILLS":
      return run.ownedSkillNodeIds.length
    case "REBIRTHS":
      return meta.rebirthCount
    case "VEINS":
      return s.veins
    case "ORES":
      return s.oresBroken
    case "MINE_SESSIONS":
      return s.mineSessions
    case "MINE_HAUL":
      return s.bestMineHaul
    case "MONSTERS":
      return s.monstersSlain ?? 0
    case "BOSSES":
      return s.bossesSlain ?? 0
    case "FLAWLESS_HUNTS":
      return s.flawlessHunts ?? 0
  }
}

/** Unlocks every achievement whose target is met; returns the newly unlocked defs. */
export function awardAchievements(
  run: RunState,
  meta: MetaState,
  defs: AchievementDef[],
): { meta: MetaState; unlocked: AchievementDef[] } {
  const owned = new Set(meta.achievementIds)
  const unlocked = defs.filter((d) => !owned.has(d.id) && achievementProgress(d.kind, run, meta) >= d.target)
  if (!unlocked.length) return { meta, unlocked }
  return { meta: { ...meta, achievementIds: [...meta.achievementIds, ...unlocked.map((d) => d.id)] }, unlocked }
}

/* ---------- Auto-drill ---------- */

export const DRILL_OVERDRIVE_MULTIPLIER = 3
export const DRILL_OVERDRIVE_MS = 30_000
export const DRILL_OVERDRIVE_COOLDOWN_MS = 10 * 60_000

export function baseDrillRate(run: RunState, config: GameConfig): number {
  const owned = new Set(run.ownedSkillNodeIds)
  return config.skillNodes.reduce((sum, n) => sum + (owned.has(n.id) ? (n.autoDrillPerSecond ?? 0) : 0), 0)
}

/** Auto strikes per second right now (0 when the drill skill isn't owned). */
export function autoDrillRate(run: RunState, config: GameConfig, now: number): number {
  const base = baseDrillRate(run, config)
  return run.drillOverdriveUntil > now ? base * DRILL_OVERDRIVE_MULTIPLIER : base
}

export function startDrillOverdrive(
  run: RunState,
  config: GameConfig,
  now: number,
): { run: RunState; error?: string } {
  if (baseDrillRate(run, config) <= 0) return { run, error: "보조 드릴 스킬이 필요합니다." }
  if (run.drillOverdriveReadyAt > now) {
    const secs = Math.ceil((run.drillOverdriveReadyAt - now) / 1000)
    return { run, error: `드릴 과부하 재충전 ${secs}초` }
  }
  return {
    run: {
      ...run,
      drillOverdriveUntil: now + DRILL_OVERDRIVE_MS,
      drillOverdriveReadyAt: now + DRILL_OVERDRIVE_COOLDOWN_MS,
    },
  }
}

/* ---------- Grants ---------- */

/** Adds CORE that counts as earned (lifetime + meta totals), e.g. golden-vein jackpots. */
export function grantBonusEnergy(
  run: RunState,
  meta: MetaState,
  amount: number,
): { run: RunState; meta: MetaState } {
  const value = Math.max(0, amount)
  return {
    run: { ...run, coreEnergy: run.coreEnergy + value, lifetimeCoreEnergy: run.lifetimeCoreEnergy + value },
    meta: { ...meta, totalCoreEnergy: meta.totalCoreEnergy + value },
  }
}
