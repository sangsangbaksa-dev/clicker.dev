import { clickerConfig } from "@/data/clicker/catalog"
import { ok, type UseCaseResult } from "@/application/result"
import type { CrisisChoice, RunState, SaveData } from "@/domain/entities/clicker"
import {
  applyOffline,
  applyRebirth,
  applyTrueEnding,
  buyActiveSkillItem,
  buyProducer,
  buyPotion,
  buySkillNode,
  buyUpgrade,
  canTriggerTrueEnding,
  createInitialSave,
  enterClickerMine,
  mineEntryCheck,
  exitClickerMine,
  grantAdminEnergy,
  grantStrikeUnits,
  isGameCompleted,
  processClick,
  processTick,
  productionSnapshot,
  resolveCrisis,
  sanitizeSave,
  startClickerGame,
  startFever,
  syncClickerMineSession,
  returnHomeRegion,
  travelToRegion,
  useActiveSkill,
  type Rng,
} from "@/domain/services/clicker-engine"
import {
  awardAchievements,
  claimGoldenVein,
  grantBonusEnergy,
  recordOreBroken,
  startDrillOverdrive,
  type VeinOutcome,
} from "@/domain/services/clicker-bonus"
import {
  mineSessionStart,
  recordMineSession,
  summarizeMineSession,
  type MineSessionStart,
  type MineSessionSummary,
} from "@/domain/services/clicker-mine-session"
import {
  huntKillBounty,
  vaultLock,
  type MonsterKind,
  type VaultGrade,
} from "@/domain/services/clicker-region-activity"
import { readClickerRaw, writeClickerRaw } from "@/infrastructure/persistence/clicker-save"

const config = clickerConfig
const rng: Rng = () => Math.random()

function maybeAutoStartGaugeFever(save: SaveData): SaveData {
  const run = save.runState
  if (run.crisisActive) return save
  if (run.fever.phase !== "IDLE" || run.fever.gauge < config.feverGaugeMax) return save
  const next = startFever(run, save.metaState, config, "GAUGE", null)
  if (next.error) return save
  return { ...save, runState: next.run }
}

/** Domain `{ run, error }` → use-case result on the same save. */
function withRun(save: SaveData, next: { run: RunState; error?: string }): UseCaseResult<SaveData> {
  if (next.error) return { ok: false, status: 400, error: next.error }
  return ok({ ...save, runState: next.run })
}

/** Unlock any achievements the latest state satisfies (permanent, meta-level). */
function withAchievements(save: SaveData): SaveData {
  const awarded = awardAchievements(save.runState, save.metaState, config.achievements)
  if (!awarded.unlocked.length) return save
  return { ...save, metaState: awarded.meta }
}

export function loadClickerGame(now: number): SaveData {
  const raw = readClickerRaw()
  if (!raw) return createInitialSave(now, config)
  try {
    return syncClickerMineSession(sanitizeSave(JSON.parse(raw) as unknown, config, now), now)
  } catch {
    return createInitialSave(now, config)
  }
}

export function persistClickerGame(save: SaveData): void {
  writeClickerRaw(JSON.stringify({ ...save, savedAt: Date.now() }))
}

export function clickerTick(save: SaveData, now: number): SaveData {
  if (isGameCompleted(save.metaState)) return save
  const synced = syncClickerMineSession(save, now)
  const elapsed = now - synced.runState.lastTickAt
  if (elapsed > 2500) {
    const off = applyOffline(synced.runState, synced.metaState, config, now)
    return withAchievements({ ...synced, runState: off.run, metaState: off.meta })
  }
  const next = processTick(synced.runState, synced.metaState, config, now)
  return withAchievements(maybeAutoStartGaugeFever({ ...synced, runState: next.run, metaState: next.meta }))
}

/** Resume from persistence: apply the offline grant and report it for the welcome-back panel. */
export function clickerResume(save: SaveData, now: number): {
  save: SaveData
  offline: { seconds: number; gained: number; capped: boolean } | null
} {
  if (isGameCompleted(save.metaState)) return { save, offline: null }
  const elapsedMs = now - save.runState.lastTickAt
  if (elapsedMs <= 2500) {
    return { save: clickerTick(save, now), offline: null }
  }
  const off = applyOffline(save.runState, save.metaState, config, now)
  const next = withAchievements({ ...save, runState: off.run, metaState: off.meta })
  if (off.gained <= 0) return { save: next, offline: null }
  return {
    save: next,
    offline: { seconds: off.seconds, gained: off.gained, capped: elapsedMs / 1000 > config.offlineCapSeconds },
  }
}

export function clickerStartGame(save: SaveData): SaveData {
  return startClickerGame(save)
}

export function clickerEnterMine(save: SaveData, now: number): { save: SaveData; error?: string } {
  return enterClickerMine(save, now, config)
}

/** Why Enter Mine would be refused right now (cooldown / cost), or undefined when allowed. */
export function clickerMineEntryError(save: SaveData, now: number): string | undefined {
  return mineEntryCheck(save, now).error
}

/** CORE the next Enter Mine will charge once the cooldown is over (0 on first entry). */
export function clickerMineEntryCost(save: SaveData, now: number): number {
  return mineEntryCheck(save, Math.max(now, save.runState.mineCooldownUntil)).cost
}

export function clickerExitMine(save: SaveData, now: number): SaveData {
  return exitClickerMine(save, now)
}

/** One strike. `payout` scales it for region activities (hunt hit, vault lock); mine = 1. */
export function clickerClick(save: SaveData, now: number, payout = 1): {
  save: SaveData
  energy: number
  critical: boolean
} {
  if (isGameCompleted(save.metaState)) {
    return { save, energy: 0, critical: false }
  }
  const next = processClick(save.runState, save.metaState, config, now, rng, payout)
  const saveAfterClick = withAchievements(
    maybeAutoStartGaugeFever({
      ...save,
      runState: next.run,
      metaState: next.meta,
    }),
  )
  return {
    save: saveAfterClick,
    energy: next.result.energyGained,
    critical: next.result.isCritical,
  }
}

export function clickerBuyPotion(save: SaveData, potionId: string): UseCaseResult<SaveData> {
  return withRun(save, buyPotion(save.runState, config, potionId))
}

export function clickerBuyActiveSkill(save: SaveData, skillId: string): UseCaseResult<SaveData> {
  return withRun(save, buyActiveSkillItem(save.runState, config, skillId))
}

export function clickerBuyProducer(save: SaveData, id: string, count: number | "MAX"): UseCaseResult<SaveData> {
  return withRun(save, buyProducer(save.runState, save.metaState, config, id, count))
}

export function clickerBuyUpgrade(save: SaveData, id: string): UseCaseResult<SaveData> {
  return withRun(save, buyUpgrade(save.runState, config, id))
}

export function clickerBuySkill(save: SaveData, id: string): UseCaseResult<SaveData> {
  return withRun(save, buySkillNode(save.runState, config, id))
}

export function clickerDrinkPotion(save: SaveData, potionId: string): UseCaseResult<SaveData> {
  const next = startFever(save.runState, save.metaState, config, "POTION", potionId)
  if (next.error) return { ok: false, status: 400, error: next.error }
  return ok({ ...save, runState: next.run, metaState: { ...save.metaState, statistics: { ...save.metaState.statistics, feverStarts: save.metaState.statistics.feverStarts + 1 } } })
}

export function clickerStartGaugeFever(save: SaveData): UseCaseResult<SaveData> {
  return withRun(save, startFever(save.runState, save.metaState, config, "GAUGE", null))
}

export function clickerUseSkill(save: SaveData, id: string, now: number): UseCaseResult<SaveData> {
  return withRun(save, useActiveSkill(save.runState, save.metaState, config, id, now))
}

export function clickerResolveCrisis(save: SaveData, choice: CrisisChoice, now: number): SaveData {
  const next = resolveCrisis(save.runState, save.metaState, config, choice, now, rng)
  return { ...save, runState: next.run, metaState: next.meta }
}

export function clickerTravelRegion(save: SaveData, regionId: string): UseCaseResult<SaveData> {
  return withRun(save, travelToRegion(save.runState, config, regionId))
}

export function clickerReturnHome(save: SaveData): UseCaseResult<SaveData> {
  return withRun(save, returnHomeRegion(save.runState, config))
}

export function clickerRebirth(save: SaveData, buffId: string, now: number): UseCaseResult<SaveData> {
  const next = applyRebirth(save.runState, save.metaState, config, buffId, now)
  if (next.error) return { ok: false, status: 400, error: next.error }
  return ok({ ...save, runState: next.run, metaState: next.meta })
}

export function clickerCanCompleteEnding(save: SaveData): boolean {
  return canTriggerTrueEnding(save.metaState, config)
}

export function clickerCompleteEnding(save: SaveData, now: number): UseCaseResult<SaveData> {
  const next = applyTrueEnding(save, config, now)
  if (next.error) return { ok: false, status: 400, error: next.error }
  return ok(next.save)
}

export function clickerAdminGrant(save: SaveData, amount: number): SaveData {
  const run = grantAdminEnergy(save.runState, amount)
  return {
    ...save,
    runState: run,
    metaState: { ...save.metaState, totalCoreEnergy: save.metaState.totalCoreEnergy + amount },
  }
}

export function clickerAdminPatch(save: SaveData, patch: Partial<SaveData["runState"]>): SaveData {
  return { ...save, runState: { ...save.runState, ...patch } }
}

/** Golden vein hit: rolls surge / jackpot / laser rush from current production. */
export function clickerClaimVein(save: SaveData, now: number): { save: SaveData; outcome: VeinOutcome } {
  const perSecond = productionSnapshot(save.runState, save.metaState, config, now).perSecond
  const next = claimGoldenVein(save.runState, save.metaState, perSecond, now, rng)
  return { save: withAchievements({ ...save, runState: next.run, metaState: next.meta }), outcome: next.outcome }
}

export function clickerOreBroken(save: SaveData): SaveData {
  return withAchievements({ ...save, metaState: recordOreBroken(save.metaState) })
}

/** Hunt kill: pays the monster's bounty and counts it. */
export function clickerMonsterSlain(save: SaveData, now: number, kind: MonsterKind): { save: SaveData; energy: number } {
  if (isGameCompleted(save.metaState)) return { save, energy: 0 }
  const paid = grantStrikeUnits(save.runState, save.metaState, config, now, huntKillBounty(kind))
  if (paid.energy <= 0) return { save, energy: 0 }
  const meta = { ...paid.meta, statistics: { ...paid.meta.statistics, monstersSlain: paid.meta.statistics.monstersSlain + 1 } }
  return { save: withAchievements({ ...save, runState: paid.run, metaState: meta }), energy: paid.energy }
}

/** Vault lock attempt: a strike scaled by the graded payout; non-miss locks are counted. */
export function clickerVaultLock(
  save: SaveData,
  now: number,
  grade: VaultGrade,
  chain: number,
): { save: SaveData; energy: number; critical: boolean; chain: number } {
  const lock = vaultLock(grade, chain)
  const hit = clickerClick(save, now, lock.payout)
  // Blocked strike (crisis): nothing happened, so the chain stands.
  if (hit.energy <= 0) return { ...hit, chain }
  if (grade === "miss") return { ...hit, chain: lock.chain }
  const meta = hit.save.metaState
  return {
    ...hit,
    save: { ...hit.save, metaState: { ...meta, statistics: { ...meta.statistics, vaultLocks: meta.statistics.vaultLocks + 1 } } },
    chain: lock.chain,
  }
}

export function clickerDrillOverdrive(save: SaveData, now: number): UseCaseResult<SaveData> {
  return withRun(save, startDrillOverdrive(save.runState, config, now))
}

/** Close out a mine session: diff counters and keep the best haul. `after` is the hub-side save. */
export function clickerFinishMineSession(
  start: MineSessionStart | null,
  before: SaveData,
  after: SaveData,
  now: number,
): { save: SaveData; summary: MineSessionSummary } {
  const diff = summarizeMineSession(start, before, now)
  const recorded = recordMineSession(after.metaState, diff.haul)
  return {
    save: { ...after, metaState: recorded.meta },
    summary: { ...diff, best: recorded.best, previousBest: recorded.previousBest },
  }
}

export { mineSessionStart as clickerMineSessionStart }

/** Earned bonus CORE (e.g. doubling the offline reward) — counts toward lifetime totals. */
export function clickerGrantBonus(save: SaveData, amount: number): SaveData {
  const next = grantBonusEnergy(save.runState, save.metaState, amount)
  return withAchievements({ ...save, runState: next.run, metaState: next.meta })
}

export { config as clickerGameConfig }
