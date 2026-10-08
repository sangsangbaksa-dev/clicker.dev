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
  mineYieldMultiplier,
  regionUnlockThreshold,
  buyRelic,
  buyWorldTreeNode,
  pullGacha,
} from "@/domain/services/clicker-engine"
import { AWAKENED_ROAR_TEXT, awakenFight, awakenedGuardianAvailable, awakenedGuardianLabel, awakenedReward, claimAwakenedVictory, isAwakenedFight } from "@/domain/services/clicker-guardian-rematch"
import { worldlineRuleFor, worldlineRuleReveal, worldlineRuleText } from "@/domain/services/clicker-worldline-rules"
import { advancePostgame, canPlayAfterCompletion, continueAfterEnding, dawnDepthNotice, getDawnDepth, showsCompletionScreen } from "@/domain/services/clicker-postgame"
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
import {
  adminGrantCurrencies,
  adminJumpToFinalBoss,
  adminReplayTutorial,
  applyGodMode,
  applySpeedBoost,
  grantSecretCode,
  type AdminModes,
} from "@/domain/services/clicker-admin-tools"
import { CLICKER_EXCHANGE_OFFERS } from "@/data/clicker/exchange"
import { buyExchangeOffer, exchangeOffers, type ExchangeOfferView } from "@/domain/services/clicker-exchange"
import { chronicleEntries, chronicleSummary, recordWorldline } from "@/domain/services/clicker-chronicle"
import { allowStrike } from "@/domain/services/clicker-strike-limiter"
import { decodeClickerSave, encodeClickerSave } from "@/domain/services/clicker-save-codec"
import { enterLair, forgeGear, leaveLair, strikeLair, tickLair, type GearSlot } from "@/domain/services/clicker-lair"
import { encodeSaveCode, parseSaveCode, type ParsedSaveCode } from "@/domain/services/clicker-save-transfer"
import { clickerCompletionRecords, clickerPersistence } from "@/application/clicker-client-bind"
import { createClickerCompletionRecord } from "@/domain/services/clicker-completion-records"
import { pauseMine, resumeMine } from "@/domain/services/clicker-mine-pause"
import { selectScreenTab, type ClickerScreenTabId, type ManageDrawerTabId } from "@/domain/services/clicker-screen-tabs"

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
/** CORE mined after the ending deepens the dawn mine (no-op before it opens). */
function withDawnProgress(prev: SaveData, next: SaveData): SaveData {
  const advanced = advancePostgame(next.metaState, next.runState.lifetimeCoreEnergy - prev.runState.lifetimeCoreEnergy)
  return advanced.meta === next.metaState ? next : { ...next, metaState: advanced.meta }
}

function withAchievements(save: SaveData): SaveData {
  const awarded = awardAchievements(save.runState, save.metaState, config.achievements)
  if (!awarded.unlocked.length) return save
  return { ...save, metaState: awarded.meta }
}

/** Set when a corrupt save could not be backed up: autosave must not overwrite it. */
let persistBlocked = false

export function loadClickerGame(now: number): SaveData {
  const store = clickerPersistence()
  const raw = store.readRaw()
  const decoded = decodeClickerSave(raw, config, now)
  if (raw && decoded.backup) {
    const kept = store.backupRaw(raw, `${decoded.status}${decoded.reason ? `: ${decoded.reason}` : ""}`, now)
    persistBlocked = !kept && decoded.status === "corrupt"
  }
  try {
    return syncClickerMineSession(decoded.save, now, config)
  } catch {
    if (raw) persistBlocked = !store.backupRaw(raw, "corrupt: 광산 세션을 복원하지 못했습니다.", now)
    return createInitialSave(now, config)
  }
}

export function persistClickerGame(save: SaveData): void {
  if (persistBlocked) return
  clickerPersistence().writeRaw(encodeClickerSave({ ...save, savedAt: Date.now() }).json)
}

/** A brand-new run, encoded exactly as the game stores it. */
export function clickerFreshSaveJson(now: number): string {
  return encodeClickerSave(createInitialSave(now, config)).json
}

export function clearClickerStoredSave(): void {
  clickerPersistence().clearRaw()
}

export function clickerPauseMine(save: SaveData, now: number): SaveData {
  return pauseMine(save, now)
}

export function clickerResumeMine(save: SaveData, now: number): SaveData {
  return resumeMine(save, now)
}

export function clickerSelectScreenTab(
  save: SaveData,
  from: ClickerScreenTabId,
  to: ClickerScreenTabId,
  now: number,
): { save: SaveData; openSkillTree: boolean; manageTab: ManageDrawerTabId | null } {
  return selectScreenTab(save, from, to, now)
}

/** Save code for the settings sheet: the current save as the loader would store it. */
export function clickerExportCode(save: SaveData): string {
  return encodeSaveCode(encodeClickerSave({ ...save, savedAt: Date.now() }).json)
}

/** The save exactly as the loader stores it — what a cloud save holds. */
export function clickerSaveJson(save: SaveData): string {
  return encodeClickerSave({ ...save, savedAt: Date.now() }).json
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
  const store = clickerPersistence()
  const current = store.readRaw()
  if (current && !store.backupRaw(current, "import: 저장 코드를 불러오기 전", now)) return false
  store.writeRaw(json)
  persistBlocked = false
  return store.readRaw() === json
}

/** Admin reset: the player chose to start over, so autosave may write again. */
export function resetClickerPersistence(): void {
  persistBlocked = false
}

/** Ticks further apart than this are a gap (reload, hidden tab), not play time. */
const TICK_GAP_MS = 2500

export function clickerTick(save: SaveData, now: number): SaveData {
  if (!canPlayAfterCompletion(save.metaState)) return save
  const synced = syncClickerMineSession(save, now, config)
  const run =
    now - synced.runState.lastTickAt > TICK_GAP_MS
      ? { ...resumeAfterGap(synced.runState), lastTickAt: now }
      : synced.runState
  const next = processTick(run, synced.metaState, config, now)
  return withDawnProgress(synced, withAchievements(maybeAutoStartGaugeFever({ ...synced, runState: tickLair(accrueRegionCurrency(run, next.run, config), config, now), metaState: next.meta })))
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
  if (!canPlayAfterCompletion(save.metaState)) {
    return { save, energy: 0, critical: false, lightning: false, quake: false, echo: false }
  }
  const next = processClick(save.runState, save.metaState, config, now, rng)
  const saveAfterClick = withDawnProgress(save, withAchievements(
    maybeAutoStartGaugeFever({
      ...save,
      runState: accrueRegionCurrency(save.runState, next.run, config),
      metaState: next.meta,
    }),
  ))
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

/** Travel. Every arrival plays the region's entry cinematic (when it has one). */
export function clickerTravelRegion(
  save: SaveData,
  regionId: string,
): UseCaseResult<{ save: SaveData; intro: RegionIntroDef | null }> {
  const next = travelToRegion(save.runState, config, regionId)
  if (next.error) return { ok: false, status: 400, error: next.error }
  const visit = markRegionVisited(save.metaState, regionId)
  const intro: RegionIntroDef | null = config.regions.find((r) => r.id === regionId)?.intro ?? null
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
  const metaState = recordWorldline(next.meta, save.runState, buffId, now)
  return ok({ ...save, runState: next.run, metaState })
}

export function clickerCanCompleteEnding(save: SaveData): boolean {
  return canTriggerTrueEnding(save.metaState, config)
}

export function clickerCompleteEnding(save: SaveData, now: number): UseCaseResult<SaveData> {
  const next = applyTrueEnding(save, config, now)
  if (next.error) return { ok: false, status: 400, error: next.error }
  return ok({ ...next.save, metaState: recordWorldline(next.save.metaState, save.runState, null, now) })
}

/** Current depth of 새벽의 광산 (0 until it opens). */
export function clickerDawnDepth(save: SaveData): number {
  return getDawnDepth(save.metaState)
}

export { dawnDepthNotice as clickerDawnDepthNotice }

/** After the ending: open the dawn mine and keep playing (rebirth stays closed). */
export function clickerContinueAfterEnding(save: SaveData, now: number): UseCaseResult<SaveData> {
  const next = continueAfterEnding(save.metaState, now)
  if (next.error) return { ok: false, status: 400, error: next.error }
  return ok({ ...save, metaState: next.meta, runState: { ...save.runState, lastTickAt: now } })
}

/** The game can tick and take taps (before the ending, or in the dawn mine). */
export function clickerCanPlay(save: SaveData): boolean {
  return canPlayAfterCompletion(save.metaState)
}

/** Show the frozen completion screen (completed, dawn mine not opened). */
export function clickerShowsCompletion(save: SaveData): boolean {
  return showsCompletionScreen(save.metaState)
}

export function clickerReadCompletionRecords() {
  return clickerCompletionRecords().read()
}

export function clickerStoreCompletionRecord(save: SaveData): boolean {
  const record = createClickerCompletionRecord(save.metaState)
  return record ? clickerCompletionRecords().save(record) : false
}

export function clickerAdminGrant(save: SaveData, amount: number): SaveData {
  const run = grantAdminEnergy(save.runState, amount)
  return {
    ...save,
    runState: run,
    metaState: { ...save.metaState, totalCoreEnergy: save.metaState.totalCoreEnergy + amount },
  }
}

export function clickerRedeemSecretCode(save: SaveData): SaveData {
  return { ...save, runState: grantSecretCode(save.runState, config) }
}

export function clickerAdminPatch(save: SaveData, patch: Partial<SaveData["runState"]>): SaveData {
  return { ...save, runState: { ...save.runState, ...patch } }
}

/** Admin: meet a region's unlock conditions (lifetime CORE and rebirths) without touching anything else. */
export function clickerAdminUnlockRegion(save: SaveData, regionId: string): SaveData {
  const region = config.regions.find((r) => r.id === regionId)
  if (!region) return save
  const run = { ...save.runState, currentWorldLine: Math.max(save.runState.currentWorldLine, (region.requiresRebirths ?? 0) + 1) }
  return {
    ...save,
    runState: {
      ...run,
      lifetimeCoreEnergy: Math.max(run.lifetimeCoreEnergy, regionUnlockThreshold(run, config, region)),
    },
  }
}

/** Golden vein hit: rolls surge / jackpot / laser rush from current production. */
export function clickerClaimVein(save: SaveData, now: number): { save: SaveData; outcome: VeinOutcome } {
  const perSecond = productionSnapshot(save.runState, save.metaState, config, now).perSecond
  const next = claimGoldenVein(save.runState, save.metaState, perSecond, now, rng, mineYieldMultiplier(save.runState, config))
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

export function clickerForge(save: SaveData, slot: GearSlot): UseCaseResult<SaveData> {
  const next = forgeGear(save.runState, config, slot)
  if (next.error) return { ok: false, status: 400, error: next.error }
  return ok({ ...save, runState: next.run })
}

/* ---------- Relic Vault ---------- */

export function clickerBuyRelic(save: SaveData, relicId: string): UseCaseResult<SaveData> {
  const next = buyRelic(save.runState, save.metaState, config, relicId)
  if (next.error) return { ok: false, status: 400, error: next.error }
  return ok({ ...save, runState: next.run, metaState: next.meta })
}

/* ---------- World skill trees · gacha ---------- */

export function clickerBuyWorldTreeNode(save: SaveData, nodeId: string): UseCaseResult<SaveData> {
  const next = buyWorldTreeNode(save.runState, config, nodeId)
  if (next.error) return { ok: false, status: 400, error: next.error }
  return ok({ ...save, runState: next.run })
}

export function clickerPullGacha(save: SaveData, count: 1 | 10, now: number, free = false) {
  const next = pullGacha(save.runState, save.metaState, config, now, rng, count, free)
  if (next.error) return { ok: false as const, status: 400, error: next.error }
  return ok({ save: withAchievements({ ...save, runState: next.run, metaState: next.meta }), rewards: next.rewards })
}

export function clickerStartBoss(save: SaveData, now: number): UseCaseResult<SaveData> {
  return withRun(save, startBossFight(save.runState, save.metaState, config, now))
}

export function clickerStrikeBoss(save: SaveData, now: number) {
  const fight = save.runState.boss
  const next = strikeBoss(save.runState, save.metaState, config, now, rng)
  // 각성 수호자: the killing blow pays 새벽 조각 (the normal guardian pays nothing new).
  const won = next.defeated && fight ? claimAwakenedVictory(next.meta, fight) : { meta: next.meta, reward: 0 }
  const after = withDawnProgress(save, { ...save, runState: accrueRegionCurrency(save.runState, next.run, config), metaState: won.meta })
  return { save: after, damage: next.damage, critical: next.critical, defeated: next.defeated, shards: won.reward }
}

/** 각성 수호자 rematch (새벽의 광산 only): the guardian fight with health scaled by dawn depth. */
export function clickerStartAwakenedGuardian(save: SaveData, now: number): UseCaseResult<SaveData> {
  if (!awakenedGuardianAvailable(save.metaState)) return { ok: false, status: 400, error: "새벽의 광산을 연 뒤에 도전할 수 있습니다." }
  if (save.runState.boss) return { ok: false, status: 400, error: "이미 싸우는 중입니다." }
  const started = startBossFight(save.runState, save.metaState, config, now)
  if (started.error || !started.run.boss) return { ok: false, status: 400, error: started.error ?? "여기에는 수호자가 없습니다." }
  return ok({ ...save, runState: { ...started.run, boss: awakenFight(started.run.boss, save.metaState) } })
}

/** What the boss screen needs to offer the rematch (null before 새벽의 광산). */
export function clickerAwakenedGuardianView(save: SaveData): { label: string; reward: number } | null {
  if (!awakenedGuardianAvailable(save.metaState)) return null
  const depth = clickerDawnDepth(save)
  return { label: awakenedGuardianLabel(depth), reward: awakenedReward(depth) }
}

export { AWAKENED_ROAR_TEXT as CLICKER_AWAKENED_ROAR_TEXT, isAwakenedFight as clickerIsAwakenedFight, awakenedGuardianLabel as clickerAwakenedLabel }

/**
 * Mine strike limiter: at most MINE_MAX_CPS strikes (taps + drill) in any rolling second.
 * Returns true when this strike may land; the caller keeps the timestamp window.
 */
export function allowMineStrike(window: number[], now: number): boolean {
  return allowStrike(window, now, MINE_MAX_CPS)
}

export { mineSessionStart as clickerMineSessionStart }

export function clickerAdminGrantCurrencies(save: SaveData, amount: number): SaveData {
  return { ...save, runState: adminGrantCurrencies(save.runState, config, amount) }
}

export function clickerAdminJumpToFinalBoss(save: SaveData, now: number): SaveData {
  return adminJumpToFinalBoss(save, config, now)
}

export { adminReplayTutorial as clickerAdminReplayTutorial }

export function clickerApplyAdminModes(prev: SaveData, next: SaveData, modes: AdminModes): SaveData {
  let run = applySpeedBoost(prev.runState, next.runState, modes.speed)
  if (modes.god) run = applyGodMode(prev.runState, run)
  return run === next.runState ? next : { ...next, runState: run }
}

export { config as clickerGameConfig, createInitialSave }

/** This worldline's rule (균형, 과열, …), or null on worldlines without one. */
export function clickerWorldlineRule(save: SaveData) {
  return worldlineRuleFor(config.worldlineRules ?? [], save.runState.currentWorldLine)
}

/** Announcement for a worldline change (cue + aria-live text), or null. */
export function clickerWorldlineRuleReveal(prevWorldline: number | null, save: SaveData): { text: string } | null {
  const rule = worldlineRuleReveal(config.worldlineRules ?? [], prevWorldline, save.runState.currentWorldLine)
  return rule ? { text: `새 세계선 규칙 · ${worldlineRuleText(rule)}` } : null
}

/* ---------- 세계선 교환소 · 기록실 ---------- */

export function clickerExchangeOffers(save: SaveData, now: number): ExchangeOfferView[] {
  return exchangeOffers(save.runState, save.metaState, config, CLICKER_EXCHANGE_OFFERS, now)
}

export function clickerBuyExchange(save: SaveData, offerId: string, now: number): UseCaseResult<SaveData> {
  const next = buyExchangeOffer(save.runState, save.metaState, config, CLICKER_EXCHANGE_OFFERS, offerId, now)
  if (next.error) return { ok: false, status: 400, error: next.error }
  return ok({ ...save, runState: next.run, metaState: next.meta })
}

export function clickerChronicle(save: SaveData) {
  return { entries: chronicleEntries(save.metaState), summary: chronicleSummary(save.metaState) }
}
