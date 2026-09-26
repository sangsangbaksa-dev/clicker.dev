import type { MetaState, SaveData } from "../entities/clicker.ts"

/** Counters captured when a timed mine session opens; diffed at exit for the result card. */
export type MineSessionStart = {
  lifetimeCore: number
  clicks: number
  crits: number
  oresBroken: number
  veins: number
  startedAt: number
}

export type MineSessionSummary = {
  /** CORE earned during the session (lifetime delta, so spending mid-session doesn't hide it). */
  haul: number
  strikes: number
  crits: number
  oresBroken: number
  veins: number
  seconds: number
  /** This haul beat the previous best. */
  best: boolean
  previousBest: number
}

export function mineSessionStart(save: SaveData, now: number): MineSessionStart {
  const stats = save.metaState.statistics
  return {
    lifetimeCore: save.runState.lifetimeCoreEnergy,
    clicks: stats.clicks,
    crits: stats.crits,
    oresBroken: stats.oresBroken,
    veins: stats.veins,
    startedAt: now,
  }
}

/**
 * Diff the session. `start` may be missing after a reload mid-session — the haul then
 * falls back to the lifetime-at-enter mark and the counters read as 0.
 */
export function summarizeMineSession(
  start: MineSessionStart | null,
  before: SaveData,
  now: number,
): Omit<MineSessionSummary, "best" | "previousBest"> {
  const stats = before.metaState.statistics
  const run = before.runState
  if (!start) {
    const haul = run.mineSessionLifetimeAtEnter
      ? run.lifetimeCoreEnergy - run.mineSessionLifetimeAtEnter
      : run.coreEnergy - (run.mineSessionCoreAtEnter || run.coreEnergy)
    return {
      haul: Math.max(0, haul),
      strikes: 0,
      crits: 0,
      oresBroken: 0,
      veins: 0,
      seconds: Math.round((run.mineSessionDurationMs || 0) / 1000),
    }
  }
  return {
    haul: Math.max(0, run.lifetimeCoreEnergy - start.lifetimeCore),
    strikes: Math.max(0, stats.clicks - start.clicks),
    crits: Math.max(0, stats.crits - start.crits),
    oresBroken: Math.max(0, stats.oresBroken - start.oresBroken),
    veins: Math.max(0, stats.veins - start.veins),
    seconds: Math.max(0, Math.round((now - start.startedAt) / 1000)),
  }
}

/** Count the session and keep the best haul (permanent across rebirths). */
export function recordMineSession(
  meta: MetaState,
  haul: number,
): { meta: MetaState; best: boolean; previousBest: number } {
  const previousBest = meta.statistics.bestMineHaul ?? 0
  const best = haul > 0 && haul > previousBest
  return {
    meta: {
      ...meta,
      statistics: {
        ...meta.statistics,
        mineSessions: (meta.statistics.mineSessions ?? 0) + 1,
        bestMineHaul: best ? haul : previousBest,
      },
    },
    best,
    previousBest,
  }
}
