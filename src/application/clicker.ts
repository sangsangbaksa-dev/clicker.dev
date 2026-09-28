import { clickerConfig } from "@/data/clicker/catalog"
import { ok, type UseCaseResult } from "@/application/result"
import type { CrisisChoice, RegionIntroDef, RunState, SaveData } from "@/domain/entities/clicker"
import {
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
  MINE_HOME_ONLY_ERROR,
  regionHasMine,
  exitClickerMine,
  grantAdminEnergy,
  isGameCompleted,
  processClick,
  processTick,
  resumeAfterGap,
  productionSnapshot,
  resolveCrisis,
  startClickerGame,
  startFever,
  syncClickerMineSession,
  returnHomeRegion,
  activateRegion,
  claimRegionChallenge,
  regionChallengeError,
  travelToRegion,
  markRegionVisited,
  activateSkill,
  finishClickerTutorial,
  slayMonster,
  drillStrike,
  startBossFight,
  strikeBoss,
  MINE_MAX_CPS,
  type Rng,
  accrueRegionCurrency,
} from "@/domain/services/clicker-engine"
import {
  awardAchievements,
  claimGoldenVein,
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
import { decodeClickerSave, encodeClickerSave } from "@/domain/services/clicker-save-codec"
import { enterLair, forgeGear, leaveLair, strikeLair, tickLair } from "@/domain/services/clicker-lair"
import { encodeSaveCode, parseSaveCode, type ParsedSaveCode } from "@/domain/services/clicker-save-transfer"
import { backupClickerRaw, readClickerRaw, writeClickerRaw } from "@/infrastructure/persistence/clicker-save"

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

/** Set when a corrupt save could not be backed up: autosave must not overwrite it. */
let persistBlocked = false

export function loadClickerGame(now: number): SaveData {
  const raw = readClickerRaw()
  const decoded = decodeClickerSave(raw, config, now)
  if (raw && decoded.backup) {
    const kept = backupClickerRaw(raw, `${decoded.status}${decoded.reason ? `: ${decoded.reason}` : ""}`, now)
    persistBlocked = !kept && decoded.status === "corrupt"
  }
  try {
    return syncClickerMineSession(decoded.save, now, config)
  } catch {
    if (raw) persistBlocked = !backupClickerRaw(raw, "corrupt: 광산 세션을 복원하지 못했습니다.", now)
    return createInitialSave(now, config)
  }
}

export function persistClickerGame(save: SaveData): void {
  if (persistBlocked) return
  writeClickerRaw(encodeClickerSave({ ...save, savedAt: Date.now() }).json)
}

/** Save code for the settings sheet: the current save as the loader would store it. */
export function clickerExportCode(save: SaveData): string {
  return encodeSaveCode(encodeClickerSave({ ...save, savedAt: Date.now() }).json)
}

export function clickerParseSaveCode(code: string, now: number): ParsedSaveCode {
  return parseSaveCode(code, config, now)
}

/**
 * Replace the stored save with an imported one. The save being replaced goes to the
 * backup list first; returns false (and writes nothing) when that backup can't be kept.
 * The caller reloads from storage afterwards.
 */
export function clickerImportSave(json: string, now: number): boolean {
  const current = readClickerRaw()
  if (current && !backupClickerRaw(current, "import: 저장 코드를 불러오기 전", now)) return false
  writeClickerRaw(json)
  persistBlocked = false
  return readClickerRaw() === json
}

/** Admin reset: the player chose to start over, so autosave may write again. */
export function resetClickerPersistence(): void {
  persistBlocked = false
}

/** Ticks further apart than this are a gap (reload, hidden tab), not play time. */
const TICK_GAP_MS = 2500

export function clickerTick(save: SaveData, now: number): SaveData {
  if (isGameCompleted(save.metaState)) return save
  const synced = syncClickerMineSession(save, now, config)
  const run =
    now - synced.runState.lastTickAt > TICK_GAP_MS
      ? { ...resumeAfterGap(synced.runState), lastTickAt: now }
      : synced.runState
  const next = processTick(run, synced.metaState, config, now)
  return withAchievements(maybeAutoStartGaugeFever({ ...synced, runState: tickLair(accrueRegionCurrency(run, next.run, config), config, now), metaState: next.meta }))
}

export function clickerStartGame(save: SaveData): SaveData {
  return startClickerGame(save)
}

export function clickerEnterMine(save: SaveData, now: number): { save: SaveData; error?: string } {
  return enterClickerMine(save, now, config)
}

/** Why Enter Mine would be refused right now (cooldown / cost), or undefined when allowed. */
export function clickerMineEntryError(save: SaveData, now: number): string | undefined {
  if (!regionHasMine(save.runState, config)) return MINE_HOME_ONLY_ERROR
  return mineEntryCheck(save, now).error
}

/** CORE the next Enter Mine will charge once the cooldown is over (0 on first entry). */
export function clickerMineEntryCost(save: SaveData, now: number): number {
  return mineEntryCheck(save, Math.max(now, save.runState.mineCooldownUntil)).cost
}

export function clickerExitMine(save: SaveData, now: number): SaveData {
  return exitClickerMine(save, now, config)
}

export function clickerClick(save: SaveData, now: number): {
  save: SaveData
  energy: number
  critical: boolean
  lightning: boolean
  quake: boolean
  echo: boolean
} {
  if (isGameCompleted(save.metaState)) {
    return { save, energy: 0, critical: false, lightning: false, quake: false, echo: false }
  }
  const next = processClick(save.runState, save.metaState, config, now, rng)
  const saveAfterClick = withAchievements(
    maybeAutoStartGaugeFever({
      ...save,
      runState: accrueRegionCurrency(save.runState, next.run, config),
      metaState: next.meta,
    }),
  )
  return {
    save: saveAfterClick,
    energy: next.result.energyGained,
    critical: next.result.isCritical,
    lightning: next.result.lightning,
    quake: next.result.quake,
    echo: next.result.echo,
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
  return withRun(save, activateSkill(save.runState, save.metaState, config, id, now))
}

export function clickerResolveCrisis(save: SaveData, choice: CrisisChoice, now: number): SaveData {
  const next = resolveCrisis(save.runState, save.metaState, config, choice, now, rng)
  return { ...save, runState: next.run, metaState: next.meta }
}

/** Travel; `intro` is the region's cinematic, played on every arrival. */
export function clickerTravelRegion(
  save: SaveData,
  regionId: string,
): UseCaseResult<{ save: SaveData; intro: RegionIntroDef | null }> {
  const next = travelToRegion(save.runState, config, regionId)
  if (next.error) return { ok: false, status: 400, error: next.error }
  const visit = markRegionVisited(save.metaState, regionId)
  const intro = config.regions.find((r) => r.id === regionId)?.intro ?? null
  return ok({ save: { ...save, runState: next.run, metaState: visit.meta }, intro })
}

export function clickerRegionActivity(save: SaveData, regionId: string, now: number): UseCaseResult<SaveData> {
  const next = activateRegion(save.runState, save.metaState, config, regionId, now)
  if (next.error) return { ok: false, status: 400, error: next.error }
  return ok({ ...save, runState: accrueRegionCurrency(save.runState, next.run, config), metaState: next.meta })
}

export function clickerRegionChallengeError(save: SaveData, regionId: string, now: number): string | undefined {
  return regionChallengeError(save.runState, config, regionId, now)
}

export function clickerClaimChallenge(
  save: SaveData,
  regionId: string,
  score: number,
  now: number,
): UseCaseResult<{ save: SaveData; reward: number }> {
  const next = claimRegionChallenge(save.runState, save.metaState, config, regionId, score, now)
  if (next.error) return { ok: false, status: 400, error: next.error }
  return ok({ save: withAchievements({ ...save, runState: accrueRegionCurrency(save.runState, next.run, config), metaState: next.meta }), reward: next.reward })
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

export function clickerFinishTutorial(save: SaveData): SaveData {
  return finishClickerTutorial(save)
}

export function clickerSlayMonster(save: SaveData, regionId: string, now: number): UseCaseResult<{ save: SaveData; reward: number }> {
  const next = slayMonster(save.runState, save.metaState, config, regionId, now)
  if (next.error) return { ok: false, status: 400, error: next.error }
  return ok({ save: withAchievements({ ...save, runState: accrueRegionCurrency(save.runState, next.run, config), metaState: next.meta }), reward: next.reward })
}

export function clickerDrill(save: SaveData, now: number): UseCaseResult<{ save: SaveData; reward: number }> {
  const next = drillStrike(save.runState, save.metaState, config, now)
  if (next.error) return { ok: false, status: 400, error: next.error }
  return ok({ save: { ...save, runState: accrueRegionCurrency(save.runState, next.run, config), metaState: next.meta }, reward: next.reward })
}

/* ---------- Lair battles & forge ---------- */

export function clickerEnterLair(save: SaveData, now: number): UseCaseResult<SaveData> {
  const next = enterLair(save.runState, config, now)
  if (next.error) return { ok: false, status: 400, error: next.error }
  return ok({ ...save, runState: next.run })
}

export function clickerLeaveLair(save: SaveData): SaveData {
  return { ...save, runState: leaveLair(save.runState) }
}

export function clickerStrikeLair(save: SaveData, now: number) {
  const next = strikeLair(save.runState, save.metaState, config, now)
  const runState = next.reward > 0 ? accrueRegionCurrency(save.runState, next.run, config) : next.run
  const out = { ...save, runState, metaState: next.meta }
  return { save: next.defeated ? withAchievements(out) : out, damage: next.damage, reward: next.reward, defeated: next.defeated }
}

export function clickerForge(save: SaveData, slot: "weapon" | "armor"): UseCaseResult<SaveData> {
  const next = forgeGear(save.runState, config, slot)
  if (next.error) return { ok: false, status: 400, error: next.error }
  return ok({ ...save, runState: next.run })
}

export function clickerStartBoss(save: SaveData, now: number): UseCaseResult<SaveData> {
  return withRun(save, startBossFight(save.runState, config, now))
}

export function clickerStrikeBoss(save: SaveData, now: number) {
  const next = strikeBoss(save.runState, save.metaState, config, now, rng)
  return { save: { ...save, runState: accrueRegionCurrency(save.runState, next.run, config), metaState: next.meta }, damage: next.damage, critical: next.critical, defeated: next.defeated }
}

/**
 * Mine strike limiter: at most MINE_MAX_CPS strikes (taps + drill) in any rolling second.
 * Returns true when this strike may land; the caller keeps the timestamp window.
 */
export function allowMineStrike(window: number[], now: number): boolean {
  while (window.length && now - window[0] >= 1000) window.shift()
  if (window.length >= MINE_MAX_CPS) return false
  window.push(now)
  return true
}

export { mineSessionStart as clickerMineSessionStart }

export { config as clickerGameConfig }
