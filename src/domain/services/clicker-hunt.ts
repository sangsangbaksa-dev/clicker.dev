import type { GameConfig, GuardianState, MetaState, RegionGuardianDef, RunState } from "../entities/clicker"
import { derivedClick, productionSnapshot } from "./clicker-engine.ts"

/**
 * Monster hunting: every region away from home has a guardian on its home screen.
 * Each tap on it is a normal mining click, and the CORE that click earns is dealt as
 * damage. A kill pays a bounty and a tougher guardian appears after a short pause.
 * HP is fixed at spawn from the player's click power then, so hunts stay a handful
 * of taps at any point of the run instead of drifting with progress.
 */
export const GUARDIAN_RESPAWN_MS = 2_500

/** Base-click hits needed for a guardian of this level (before crits, combo, strikes). */
export function guardianHits(level: number): number {
  return Math.min(120, 24 + 8 * level)
}

/** Seconds of current production paid on a kill, on top of what the taps already earned. */
export function guardianBountySeconds(level: number): number {
  return Math.min(180, 30 + 10 * level)
}

export function regionGuardian(config: GameConfig, regionId: string): RegionGuardianDef | undefined {
  const region = config.regions.find((r) => r.id === regionId)
  return region && !region.isHome ? region.guardian : undefined
}

function spawn(run: RunState, meta: MetaState, config: GameConfig, level: number): GuardianState {
  const click = Math.max(1, derivedClick(run, meta, config).click)
  const maxHp = click * guardianHits(level)
  return { level, hp: maxHp, maxHp, respawnAt: 0 }
}

/**
 * The guardian standing in `regionId` right now: spawned on first sight, respawned once
 * its timer has passed. Undefined for home and regions without a guardian.
 */
export function currentGuardian(
  run: RunState,
  meta: MetaState,
  config: GameConfig,
  regionId: string,
  now: number,
): GuardianState | undefined {
  if (!regionGuardian(config, regionId)) return undefined
  const state = run.guardians[regionId]
  if (!state || state.maxHp <= 0) return spawn(run, meta, config, state?.level ?? 0)
  if (state.hp <= 0 && state.respawnAt > 0 && now >= state.respawnAt) return spawn(run, meta, config, state.level)
  return state
}

export type GuardianStrike = {
  run: RunState
  meta: MetaState
  damage: number
  killed: boolean
  /** CORE paid for the kill (0 when it survived). */
  bounty: number
  /** Level of the guardian that was hit. */
  level: number
}

/** Deal `damage` to the current region's guardian; a no-op while it is down or absent. */
export function strikeGuardian(
  run: RunState,
  meta: MetaState,
  config: GameConfig,
  damage: number,
  now: number,
): GuardianStrike | undefined {
  const regionId = run.currentRegionId
  const guardian = currentGuardian(run, meta, config, regionId, now)
  if (!guardian || guardian.hp <= 0) return undefined
  const dealt = Math.max(0, damage)
  const hp = Math.max(0, guardian.hp - dealt)
  if (hp > 0) {
    return {
      run: { ...run, guardians: { ...run.guardians, [regionId]: { ...guardian, hp } } },
      meta,
      damage: dealt,
      killed: false,
      bounty: 0,
      level: guardian.level,
    }
  }
  const perSecond = productionSnapshot(run, meta, config, now).perSecond
  const bounty = Math.max(guardian.maxHp, perSecond * guardianBountySeconds(guardian.level))
  return {
    run: {
      ...run,
      coreEnergy: run.coreEnergy + bounty,
      lifetimeCoreEnergy: run.lifetimeCoreEnergy + bounty,
      guardians: {
        ...run.guardians,
        [regionId]: { level: guardian.level + 1, hp: 0, maxHp: guardian.maxHp, respawnAt: now + GUARDIAN_RESPAWN_MS },
      },
    },
    meta: {
      ...meta,
      totalCoreEnergy: meta.totalCoreEnergy + bounty,
      statistics: { ...meta.statistics, monsterKills: meta.statistics.monsterKills + 1 },
    },
    damage: dealt,
    killed: true,
    bounty,
    level: guardian.level,
  }
}
