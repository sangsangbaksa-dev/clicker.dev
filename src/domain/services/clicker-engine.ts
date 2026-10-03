import type {
  ActiveSkillDef,
  ClickResult,
  ComboState,
  CrisisChoice,
  FeverState,
  GameConfig,
  InstabilityLevel,
  MetaState,
  PotionDef,
  ProductionSnapshot,
  RunState,
  SaveData,
  WorldTreeNodeDef,
  SkillNodeDef,
  TimedBuff,
  RelicDef,
  TranscendenceDef,
  UpgradeDef,
} from "../entities/clicker"
import {
  achievementProductionMultiplier,
  eventBoostMultiplier,
  pruneEventBoosts,
} from "./clicker-bonus.ts"
import { clearMinePause, resumeMine } from "./clicker-mine-pause.ts"

/** Base timed-mine length before skill-tree extensions. Balance PROVISIONAL. */
export const MINE_SESSION_BASE_MS = 10_000
export const MINE_REENTER_COOLDOWN_MS = 10_000
/** The re-entry wait the economy was tuned on; mine yields scale so CORE per real minute stays as it was. */
export const MINE_PACE_REFERENCE_COOLDOWN_MS = 30_000
const REENTER_MIN_COOLDOWN_MS = 5_000
/** Strikes per second allowed in the mine (taps + Space + assist drill together). */
export { MINE_MAX_CPS } from "./clicker-strike-limiter.ts"

export type Rng = () => number

export const DEFAULT_MUSIC_VOLUME = 0.4

export function createInitialCombo(): ComboState {
  return { count: 0, multiplier: 1, expiresAt: 0, maxCombo: 25 }
}

export function createInitialFever(): FeverState {
  return {
    phase: "IDLE",
    remainingTime: 0,
    duration: 0,
    gauge: 0,
    combo: 0,
    maxCombo: 10,
    critsThisFever: 0,
    finisherReady: false,
    finisherUsed: false,
    source: null,
    potionId: null,
  }
}

export function createInitialRun(now: number, meta: MetaState, config: GameConfig): RunState {
  const scale = worldlineCostScale(meta, config)
  const starting = startingEnergy(meta, config) * scale
  return {
    coreEnergy: starting,
    lifetimeCoreEnergy: starting,
    instability: 0,
    combo: createInitialCombo(),
    fever: createInitialFever(),
    producerLevels: Object.fromEntries(config.producers.map((p) => [p.id, 0])),
    ownedUpgradeIds: [],
    ownedSkillNodeIds: [],
    skillPoints: 0,
    skillPointsSpent: 0,
    potions: {},
    skillItems: {},
    skillCooldowns: {},
    activeBuffs: [],
    crisisActive: false,
    currentObjectiveId: config.objectives[0]?.id ?? "first_node",
    runStartedAt: now,
    lastTickAt: now,
    regionCurrency: {},
    worldTreeIds: [],
    currentWorldLine: meta.rebirthCount + 1,
    currentRegionId: config.regions.find((r) => r.isHome)?.id ?? config.regions[0]?.id ?? "core_chamber",
    clickCount: 0,
    feverStarts: 0,
    respecCount: 0,
    mineSessionEndsAt: 0,
    minePausedRemainMs: 0,
    mineCooldownUntil: 0,
    mineSessionCoreAtEnter: 0,
    mineSessionDurationMs: 0,
    eventBoosts: [],
    drillOverdriveUntil: 0,
    drillOverdriveReadyAt: 0,
    regionCooldowns: {},
    challengeCooldowns: {},
    vaultDeposit: 0,
    vaultReadyAt: 0,
    lightningStormUntil: 0,
    droneSwarmUntil: 0,
    costScale: scale,
    monsterRespawnAt: {},
    drillGauge: 0,
    drillCooldownUntil: 0,
    boss: null,
  }
}

export function createInitialMeta(): MetaState {
  return {
    totalCoreEnergy: 0,
    rebirthCount: 0,
    transcendenceIds: [],
    statistics: {
      clicks: 0,
      crits: 0,
      maxCombo: 0,
      feverStarts: 0,
      veins: 0,
      oresBroken: 0,
      mineSessions: 0,
      bestMineHaul: 0,
    },
    achievementIds: [],
    visitedRegionIds: [],
    gameCompleted: false,
    completedAt: null,
    bossDefeated: false,
    monstersSlain: 0,
    relicLevels: {},
  }
}

export function isGameCompleted(meta: MetaState): boolean {
  return Boolean(meta.gameCompleted)
}

export function canTriggerTrueEnding(meta: MetaState, config: GameConfig): boolean {
  void config
  return !meta.gameCompleted && Boolean(meta.bossDefeated)
}

export function applyTrueEnding(save: SaveData, config: GameConfig, now: number): { save: SaveData; error?: string } {
  if (save.metaState.gameCompleted) return { save, error: "이미 완료된 기록입니다." }
  if (!canTriggerTrueEnding(save.metaState, config)) {
    return { save, error: "아직 코어 수호자를 쓰러뜨리지 않았습니다." }
  }
  return {
    save: {
      ...save,
      metaState: {
        ...save.metaState,
        gameCompleted: true,
        completedAt: now,
      },
    },
  }
}

export function createInitialSave(now: number, config: GameConfig): SaveData {
  const meta = createInitialMeta()
  return {
    schemaVersion: config.schemaVersion,
    savedAt: now,
    runState: createInitialRun(now, meta, config),
    metaState: meta,
    settings: {
      muted: false,
      musicMuted: false,
      musicVolume: DEFAULT_MUSIC_VOLUME,
      gameStarted: false,
      introSeen: false,
      tutorialSeen: false,
      playSurface: "hub",
    },
  }
}

/** Title CTA: clear title and land on the upgrades/skills hub (not the mine). */
export function startClickerGame(save: SaveData): SaveData {
  if (save.settings.gameStarted) return save
  return {
    ...save,
    settings: {
      ...save.settings,
      gameStarted: true,
      introSeen: true,
      tutorialSeen: false,
      playSurface: "hub",
    },
  }
}

/** Tutorial overlay finished or skipped. */
export function finishClickerTutorial(save: SaveData): SaveData {
  if (save.settings.tutorialSeen) return save
  return { ...save, settings: { ...save.settings, tutorialSeen: true } }
}

/** Timed mine length: 10s base + owned skill `mineSessionSecondsAdd` totals. */
export function mineSessionDurationMs(run: RunState, config: GameConfig): number {
  const addSec = ownedSkills(run, config).reduce((sum, n) => sum + (n.mineSessionSecondsAdd ?? 0), 0)
  return MINE_SESSION_BASE_MS + Math.max(0, addSec) * 1000
}

/** Whether Enter Mine is allowed right now. Entry is free; only the re-enter cooldown applies. */
export function mineEntryCheck(save: SaveData, now: number): { cost: number; error?: string } {
  if (save.runState.mineCooldownUntil > now) {
    const secs = Math.ceil((save.runState.mineCooldownUntil - now) / 1000)
    return { cost: 0, error: `광산 재입장 대기 ${secs}초` }
  }
  // Ore strikes yield nothing during a crisis; entering would only burn the cooldown.
  if (save.runState.crisisActive) return { cost: 0, error: "위기를 먼저 해소하세요." }
  return { cost: 0 }
}

/** Enter timed mine from hub Enter Mine CTA. Session length from `mineSessionDurationMs`. */
export function enterClickerMine(
  save: SaveData,
  now: number,
  config: GameConfig,
): { save: SaveData; error?: string } {
  if (save.settings.playSurface === "mine" && save.runState.mineSessionEndsAt > now) {
    return { save }
  }
  if ((save.runState.minePausedRemainMs ?? 0) > 0) {
    return { save: resumeMine(save, now) }
  }
  if (!regionHasMine(save.runState, config)) return { save, error: MINE_HOME_ONLY_ERROR }
  const { cost, error } = mineEntryCheck(save, now)
  if (error) return { save, error }
  const coreAfterCost = save.runState.coreEnergy - cost
  const durationMs = mineSessionDurationMs(
    { ...save.runState, coreEnergy: coreAfterCost },
    config,
  )
  return {
    save: {
      ...save,
      settings: { ...save.settings, playSurface: "mine" },
      runState: clearMinePause({
        ...save.runState,
        coreEnergy: coreAfterCost,
        mineSessionEndsAt: now + durationMs,
        mineSessionCoreAtEnter: coreAfterCost,
        mineSessionDurationMs: durationMs,
      }),
    },
  }
}

function cooldownCutMs(run: RunState, config?: GameConfig): number {
  return config ? ownedSkills(run, config).reduce((s, n) => s + (n.cooldownReduceSec ?? 0), 0) * 1000 : 0
}

/** Mine re-entry cooldown: 10s base, minus owned `cooldownReduceSec`, never under 5s. */
export function reentryCooldownMs(run: RunState, config?: GameConfig): number {
  return Math.max(REENTER_MIN_COOLDOWN_MS, MINE_REENTER_COOLDOWN_MS - cooldownCutMs(run, config))
}

/** The old 30s-base wait (same cuts); the drill still paces on it and mine yields are measured against it. */
function referenceCooldownMs(run: RunState, config?: GameConfig): number {
  return Math.max(REENTER_MIN_COOLDOWN_MS, MINE_PACE_REFERENCE_COOLDOWN_MS - cooldownCutMs(run, config))
}

/**
 * Share of a mine session's CORE that is paid out. With the shorter wait a player fits in more
 * sessions per minute, so each one pays (session + wait) / (session + reference wait): the CORE
 * earned per real minute of play, and so the time to each goal, stays as it was.
 */
export function mineYieldMultiplier(run: RunState, config: GameConfig): number {
  if (run.mineSessionEndsAt <= 0) return 1
  const session = run.mineSessionDurationMs > 0 ? run.mineSessionDurationMs : mineSessionDurationMs(run, config)
  return (session + reentryCooldownMs(run, config)) / (session + referenceCooldownMs(run, config))
}

/** Leave mine → hub; starts re-enter cooldown. */
export function exitClickerMine(save: SaveData, now: number, config?: GameConfig): SaveData {
  if (save.settings.playSurface !== "mine" && save.runState.mineSessionEndsAt <= 0) {
    return {
      ...save,
      settings: { ...save.settings, playSurface: "hub" },
    }
  }
  return {
    ...save,
    settings: { ...save.settings, playSurface: "hub" },
    runState: clearMinePause({
      ...save.runState,
      mineSessionEndsAt: 0,
      mineCooldownUntil: now + reentryCooldownMs(save.runState, config),
      mineSessionCoreAtEnter: 0,
      mineSessionDurationMs: 0,
    }),
  }
}

/** Tick helper: auto-exit when the timed session expires. */
export function syncClickerMineSession(save: SaveData, now: number, config?: GameConfig): SaveData {
  if (save.settings.playSurface !== "mine") return save
  if (save.runState.mineSessionEndsAt <= 0 || save.runState.mineSessionEndsAt <= now) {
    return exitClickerMine(save, now, config)
  }
  return save
}

function ownedUpgrades(run: RunState, config: GameConfig): UpgradeDef[] {
  const set = new Set(run.ownedUpgradeIds)
  return config.upgrades.filter((u) => set.has(u.id))
}

function ownedSkills(run: RunState, config: GameConfig): SkillNodeDef[] {
  const set = new Set(run.ownedSkillNodeIds)
  return config.skillNodes.filter((n) => set.has(n.id))
}

/** Lightning starts at ×3, shockwave every 30 clicks (floor 5), drones at 50% click power. */
export const LIGHTNING_BASE_MULTIPLIER = 3
export const LIGHTNING_CHANCE_CAP = 0.6
export const QUAKE_BASE_INTERVAL = 30
export const QUAKE_MIN_INTERVAL = 5
export const ECHO_CHANCE_CAP = 0.5
export const DRONE_BASE_EFFICIENCY = 0.5

export type StrikeStats = {
  lightningChance: number
  lightningMultiplier: number
  lightningChains: number
  quakeMultiplier: number
  quakeInterval: number
  echoChance: number
  droneStrikesPerSecond: number
  droneEfficiency: number
}

/** Skills, walked worldlines and the current region all feed the strike methods; `now` adds timed region effects. */
export function strikeStats(run: RunState, config: GameConfig, meta?: MetaState, now?: number): StrikeStats {
  const skills = ownedSkills(run, config)
  const trans = meta ? ownedTranscendence(meta, config) : []
  const region = currentRegionDef(run, config)
  const sum = (key: keyof SkillNodeDef) => skills.reduce((s, n) => s + ((n[key] as number | undefined) ?? 0), 0)
  const transSum = (key: "lightningChanceAdd" | "echoChanceAdd" | "droneStrikesPerSecond") =>
    trans.reduce((s, t) => s + (t[key] ?? 0), 0)
  const storm = now !== undefined && run.lightningStormUntil > now
  const lightningChance = storm
    ? 1
    : Math.min(LIGHTNING_CHANCE_CAP, sum("lightningChanceAdd") + transSum("lightningChanceAdd") + (region?.lightningChanceAdd ?? 0))
  const quakeMultiplier = sum("quakeMultiplierAdd")
  const swarm = now !== undefined && run.droneSwarmUntil > now ? droneSwarmMultiplier(config) : 1
  return {
    lightningChance,
    lightningMultiplier: lightningChance > 0 ? LIGHTNING_BASE_MULTIPLIER + sum("lightningMultiplierAdd") : 0,
    lightningChains: sum("lightningChainAdd"),
    quakeMultiplier,
    quakeInterval: Math.max(
      QUAKE_MIN_INTERVAL,
      QUAKE_BASE_INTERVAL - sum("quakeIntervalReduce") - (region?.quakeIntervalReduce ?? 0),
    ),
    echoChance: Math.min(ECHO_CHANCE_CAP, sum("echoChanceAdd") + transSum("echoChanceAdd")),
    droneStrikesPerSecond: (sum("droneStrikesPerSecond") + transSum("droneStrikesPerSecond")) * swarm,
    droneEfficiency: DRONE_BASE_EFFICIENCY + sum("droneEfficiencyAdd") + (region?.droneEfficiencyAdd ?? 0),
  }
}

function droneSwarmMultiplier(config: GameConfig): number {
  const def = config.regions.find((r) => r.activity?.kind === "DRONE_SWARM")?.activity
  return def?.multiplier ?? 1
}

/** CORE per second from mining drones (outside of producer production). */
export function droneEnergyPerSecond(run: RunState, meta: MetaState, config: GameConfig, now?: number): number {
  const stats = strikeStats(run, config, meta, now)
  if (stats.droneStrikesPerSecond <= 0) return 0
  return derivedClick(run, meta, config).click * stats.droneStrikesPerSecond * stats.droneEfficiency
}

/** Walked worldlines plus Relic Vault levels — both are permanent and feed the same stats. */
function ownedTranscendence(meta: MetaState, config: GameConfig): TranscendenceDef[] {
  const set = new Set(meta.transcendenceIds)
  return [...config.transcendence.filter((t) => set.has(t.id)), ...relicEffects(meta, config)]
}

/* ------------------------------------------------------------------ Relic Vault */

/** The vault opens once three worldlines have been walked (i.e. from the fourth). */
export const RELIC_UNLOCK_REBIRTHS = 3
/** Level 1 of a relic costs this share of the current rebirth goal, in its world's currency… */
export const RELIC_COST_SHARE = 0.03
/** …and each further level this much more. */
export const RELIC_COST_GROWTH = 4

const RELIC_MULTIPLIERS = new Set(["clickMultiplier", "productionMultiplier", "criticalMultiplier", "feverIntensity"])

export function relicLevel(meta: MetaState, relicId: string): number {
  return meta.relicLevels?.[relicId] ?? 0
}

export function relicVaultOpen(meta: MetaState): boolean {
  return meta.rebirthCount >= RELIC_UNLOCK_REBIRTHS
}

/** Highest level a relic can reach this worldline: 1 on the fourth, one more each worldline after. */
export function relicLevelCap(run: RunState, relic: RelicDef): number {
  return Math.max(0, Math.min(relic.maxLevel, run.currentWorldLine - RELIC_UNLOCK_REBIRTHS))
}

/** A relic's effect at `level`: multipliers compound, additions stack. */
export function relicEffectAt(relic: RelicDef, level: number): RelicDef["perLevel"] {
  const out: Record<string, number> = {}
  for (const [key, value] of Object.entries(relic.perLevel)) {
    if (typeof value !== "number") continue
    out[key] = RELIC_MULTIPLIERS.has(key) ? value ** level : value * level
  }
  return out as RelicDef["perLevel"]
}

function relicEffects(meta: MetaState, config: GameConfig): TranscendenceDef[] {
  return (config.relics ?? [])
    .map((relic) => ({ relic, level: relicLevel(meta, relic.id) }))
    .filter(({ level }) => level > 0)
    .map(({ relic, level }) => ({
      id: relic.id,
      name: relic.name,
      description: relic.lore,
      identity: "relic",
      assetId: relic.assetId,
      ...relicEffectAt(relic, level),
    }))
}

/** World currency the next level costs — a share of this worldline's goal, so it always takes a while. */
export function relicCost(meta: MetaState, config: GameConfig, relic: RelicDef): number {
  return Math.ceil(rebirthRequirement(meta, config) * RELIC_COST_SHARE * RELIC_COST_GROWTH ** relicLevel(meta, relic.id))
}

export function relicError(run: RunState, meta: MetaState, config: GameConfig, relicId: string): string | undefined {
  const relic = (config.relics ?? []).find((r) => r.id === relicId)
  if (!relic) return "유물이 없습니다."
  if (!relicVaultOpen(meta)) return `유물 보관소는 세계선 ${RELIC_UNLOCK_REBIRTHS + 1}부터 열립니다.`
  if (relicLevel(meta, relicId) >= relic.maxLevel) return "최대 레벨입니다."
  if (relicLevel(meta, relicId) >= relicLevelCap(run, relic)) return "다음 세계선에서 더 강화할 수 있습니다."
  const wallet = { ...run.regionCurrency }
  if (!payRegionCurrency(wallet, config, relic.regionId, relicCost(meta, config, relic))) {
    const region = config.regions.find((r) => r.id === relic.regionId)
    return `${region?.currency?.name ?? "지역 화폐"}이(가) 부족합니다.`
  }
  return undefined
}

/** Buy the next level of a relic: the world currency comes out of this run, the level stays forever. */
export function buyRelic(
  run: RunState,
  meta: MetaState,
  config: GameConfig,
  relicId: string,
): { run: RunState; meta: MetaState; error?: string } {
  const error = relicError(run, meta, config, relicId)
  if (error) return { run, meta, error }
  const relic = config.relics.find((r) => r.id === relicId)!
  const wallet = { ...run.regionCurrency }
  payRegionCurrency(wallet, config, relic.regionId, relicCost(meta, config, relic))
  return {
    run: { ...run, regionCurrency: wallet },
    meta: { ...meta, relicLevels: { ...meta.relicLevels, [relicId]: relicLevel(meta, relicId) + 1 } },
  }
}

/** Permanent multiplier on click and production: compounding per rebirth. */
export function worldlineMultiplier(meta: MetaState, config: GameConfig): number {
  return (1 + config.worldlineBonus) ** meta.rebirthCount
}

/**
 * Price level of a worldline: producer, upgrade, circuit and shop prices and unlock thresholds
 * scale by it. The rebirth goal grows faster (`rebirthGrowth`), so each worldline climbs
 * further up the producer ladder and circuit tree than the last.
 */
export function worldlineCostScale(meta: MetaState, config: GameConfig): number {
  return config.priceGrowth ** meta.rebirthCount
}

/** A catalog price at this run's price level. */
export function scaledCost(run: RunState, cost: number): number {
  return cost * (run.costScale || 1)
}

/** Lifetime CORE the current worldline must reach before it can fold. */
export function rebirthRequirement(meta: MetaState, config: GameConfig): number {
  return config.rebirthEnergy * config.rebirthGrowth ** meta.rebirthCount * (config.rebirthGoalScale?.[meta.rebirthCount] ?? 1)
}

function startingEnergy(meta: MetaState, config: GameConfig): number {
  let energy = 0
  for (const t of ownedTranscendence(meta, config)) energy += t.startingEnergy ?? 0
  return energy
}

export function product(values: number[]): number {
  return values.reduce((acc, n) => acc * n, 1)
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function applyInstabilityDelta(run: RunState, delta: number): RunState {
  return { ...run, instability: clamp(run.instability + delta, 0, 100) }
}

/**
 * Hoarding destabilises the core: CORE plus every world currency held, measured in minutes of
 * current production, pushes instability up — and the more is held, the much faster it climbs
 * (a power curve, not a gentle log). Under ~2 minutes of income held, nothing happens.
 */
export const HOARD_FREE_MINUTES = 2
export const HOARD_INSTABILITY_RATE = 0.06
export const HOARD_CURVE = 0.8
/** Ceiling on hoard-driven instability: 100 takes at least 50 seconds. */
export const HOARD_MAX_RATE = 2

export function hoardInstabilityPerSecond(run: RunState, perSecond: number): number {
  // No production yet (fresh run): nothing to measure the hoard against.
  if (!(perSecond > 0)) return 0
  const held = run.coreEnergy + Object.values(run.regionCurrency ?? {}).reduce((s, v) => s + (v > 0 ? v : 0), 0)
  const minutes = held / (perSecond * 60)
  if (!(minutes > HOARD_FREE_MINUTES)) return 0
  return Math.min(HOARD_MAX_RATE, HOARD_INSTABILITY_RATE * (minutes / HOARD_FREE_MINUTES) ** HOARD_CURVE)
}

/**
 * At 100 instability the core collapses on its own — no choice to make: half of the CORE held
 * is lost and instability falls back to a calm level. The UI warns at INSTABILITY_WARNING.
 */
export const CRISIS_CORE_LOSS = 0.5
export const CRISIS_RESET_INSTABILITY = 30
export const INSTABILITY_WARNING = 70

export function collapseCore(run: RunState, now: number): RunState {
  const loss = run.coreEnergy * CRISIS_CORE_LOSS
  return {
    ...run,
    crisisActive: false,
    coreEnergy: run.coreEnergy - loss,
    instability: CRISIS_RESET_INSTABILITY,
    lastCollapse: { at: now, loss },
  }
}

export function instabilityLevel(value: number): InstabilityLevel {
  if (value >= 100) return "CRISIS"
  if (value >= 70) return "HIGH"
  if (value >= 40) return "MID"
  return "LOW"
}

export function instabilityReward(value: number, bonus = 0): number {
  let base = 1
  if (value >= 99) base = 1.55
  else if (value >= 90) base = 1.4
  else if (value >= 80) base = 1.25
  else if (value >= 60) base = 1.12
  else if (value >= 40) base = 1.05
  return base * (1 + bonus)
}

function feverActive(fever: FeverState): boolean {
  return fever.phase === "FEVER" || fever.phase === "IGNITION"
}

/** FEVER only runs inside a mine session; outside, its timer and bonuses are on hold. */
export function feverPaused(run: RunState): boolean {
  return feverActive(run.fever) && run.mineSessionEndsAt <= 0
}

function feverRunning(run: RunState): boolean {
  return feverActive(run.fever) && !feverPaused(run)
}

export function currentRegionDef(run: RunState, config: GameConfig) {
  return (
    config.regions.find((r) => r.id === run.currentRegionId) ??
    config.regions.find((r) => r.isHome) ??
    config.regions[0]
  )
}

/** Multipliers from the region the player is currently in (1 when absent). */
export function regionPresenceMultipliers(run: RunState, config: GameConfig): {
  click: number
  production: number
} {
  const region = currentRegionDef(run, config)
  const tree = region ? worldTreeMultiplier(run, config, region.id, "presenceMultiplier") : 1
  return {
    click: (region?.clickMultiplier ?? 1) * tree,
    production: (region?.productionMultiplier ?? 1) * tree,
  }
}

/**
 * Bought multipliers (upgrades + skill circuits) past `stackSoftCap` count only as a power of
 * the excess, so buying out the catalog late in a worldline is a climb, not a ×10⁸ cliff.
 */
export function softStack(multiplier: number, config: GameConfig): number {
  const cap = config.stackSoftCap
  if (!cap || multiplier <= cap) return multiplier
  return cap * (multiplier / cap) ** (config.stackSoftExponent ?? 1)
}

export function derivedClick(run: RunState, meta: MetaState, config: GameConfig) {
  const upgrades = ownedUpgrades(run, config)
  const skills = ownedSkills(run, config)
  const trans = ownedTranscendence(meta, config)
  const region = regionPresenceMultipliers(run, config)
  let click = config.baseClick
  click *= softStack(product(upgrades.map((u) => u.clickMultiplier ?? 1)) * product(skills.map((s) => s.clickMultiplier ?? 1)), config)
  click *= product(trans.map((t) => t.clickMultiplier ?? 1))
  click *= worldlineMultiplier(meta, config)
  click *= region.click
  for (const syn of config.synergies) {
    if ((run.producerLevels[syn.producerId] ?? 0) >= syn.minLevel && syn.clickBonus) {
      click *= 1 + syn.clickBonus
    }
  }
  let critChance =
    config.baseCritChance +
    upgrades.reduce((s, u) => s + (u.criticalChanceAdd ?? 0), 0) +
    skills.reduce((s, n) => s + (n.criticalChanceAdd ?? 0), 0)
  if (feverRunning(run)) {
    critChance += config.feverCritChanceAdd
    if (run.fever.potionId) {
      const potion = config.potions.find((p) => p.id === run.fever.potionId)
      critChance += potion?.criticalChanceAdd ?? 0
    }
  }
  if (critChance > config.critChanceSoftCap) {
    critChance = config.critChanceSoftCap + (critChance - config.critChanceSoftCap) * 0.3
  }
  critChance = clamp(critChance, 0, 0.85)
  const critMult =
    config.baseCritMultiplier *
    product(upgrades.map((u) => u.criticalMultiplier ?? 1)) *
    product(skills.map((s) => s.criticalMultiplier ?? 1)) *
    product(trans.map((t) => t.criticalMultiplier ?? 1))
  const comboMax =
    25 +
    upgrades.reduce((s, u) => s + (u.comboMaxAdd ?? 0), 0) +
    skills.reduce((s, n) => s + (n.comboMaxAdd ?? 0), 0)
  const comboWindow =
    config.comboWindow +
    skills.reduce((s, n) => s + (n.comboWindowAdd ?? 0), 0) +
    trans.reduce((s, t) => s + (t.comboWindowAdd ?? 0), 0)
  return { click, critChance, critMult, comboMax, comboWindow }
}

function feverMultipliers(run: RunState, meta: MetaState, config: GameConfig) {
  if (!feverRunning(run)) {
    return { click: 1, production: 1, intensity: 1 }
  }
  const upgrades = ownedUpgrades(run, config)
  const skills = ownedSkills(run, config)
  const trans = ownedTranscendence(meta, config)
  const intensity =
    product(upgrades.map((u) => u.feverIntensity ?? 1)) *
    product(skills.map((s) => s.feverIntensity ?? 1)) *
    product(trans.map((t) => t.feverIntensity ?? 1))
  let click = config.feverClickMultiplier
  let production = config.feverProductionMultiplier
  if (run.fever.potionId) {
    const potion = config.potions.find((p) => p.id === run.fever.potionId)
    if (potion) {
      click = potion.clickMultiplier
      production = potion.productionMultiplier
    }
  }
  const comboBonus = 1 + Math.max(0, run.fever.combo - 1) * 0.05
  const cappedCombo = Math.min(comboBonus, 1.45)
  return {
    click: click * intensity * cappedCombo,
    production: production * intensity,
    intensity,
  }
}

function feverDurationSeconds(run: RunState, meta: MetaState, config: GameConfig, potion?: PotionDef): number {
  const upgrades = ownedUpgrades(run, config)
  const skills = ownedSkills(run, config)
  const trans = ownedTranscendence(meta, config)
  let duration = potion?.duration ?? config.feverDuration
  duration += upgrades.reduce((s, u) => s + (u.feverDurationAdd ?? 0), 0)
  duration += skills.reduce((s, n) => s + (n.feverDurationAdd ?? 0), 0)
  duration += trans.reduce((s, t) => s + (t.feverDurationAdd ?? 0), 0)
  for (const syn of config.synergies) {
    if ((run.producerLevels[syn.producerId] ?? 0) >= syn.minLevel && syn.feverDurationBonus) {
      duration *= 1 + syn.feverDurationBonus
    }
  }
  return duration
}

export function producerCost(config: GameConfig, producerId: string, level: number, scale = 1): number {
  const producer = config.producers.find((p) => p.id === producerId)
  if (!producer) return Number.POSITIVE_INFINITY
  return producer.baseCost * producer.costGrowth ** level * scale
}

export function producerBulkCost(
  config: GameConfig,
  producerId: string,
  level: number,
  count: number,
  scale = 1
): number {
  const producer = config.producers.find((p) => p.id === producerId)
  if (!producer || count <= 0) return 0
  const g = producer.costGrowth
  const first = producer.baseCost * g ** level * scale
  if (Math.abs(g - 1) < 1e-9) return first * count
  return first * (g ** count - 1) / (g - 1)
}

export function maxAffordable(
  config: GameConfig,
  producerId: string,
  level: number,
  energy: number,
  scale = 1
): number {
  if (energy <= 0) return 0
  let lo = 0
  let hi = 1
  while (producerBulkCost(config, producerId, level, hi, scale) <= energy && hi < 10_000) hi *= 2
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2)
    if (producerBulkCost(config, producerId, level, mid, scale) <= energy) lo = mid
    else hi = mid - 1
  }
  return lo
}

export function isProducerUnlocked(run: RunState, config: GameConfig, producerId: string): boolean {
  const producer = config.producers.find((p) => p.id === producerId)
  if (!producer) return false
  // Only the worldline gate remains: every producer of an open worldline can be bought right away.
  return (producer.requiresWorldLine ?? 1) <= run.currentWorldLine
}

/** Active skills live in the mine: they can only be cast there, and their cooldowns and buffs stand still outside it. */
export function skillClockRunning(run: RunState): boolean {
  return run.mineSessionEndsAt > 0
}

/** Product of every running active-skill buff's multiplier for `field`. */
export function buffMultiplier(run: RunState, now: number, field: "productionMultiplier" | "clickMultiplier", config: GameConfig): number {
  if (!skillClockRunning(run)) return 1
  let m = 1
  for (const b of run.activeBuffs) {
    if (b.expiresAt <= now) continue
    m *= config.activeSkills.find((s) => s.id === b.id)?.[field] ?? 1
  }
  return m
}

export function productionSnapshot(
  run: RunState,
  meta: MetaState,
  config: GameConfig,
  now: number
): ProductionSnapshot {
  const upgrades = ownedUpgrades(run, config)
  const skills = ownedSkills(run, config)
  const trans = ownedTranscendence(meta, config)
  const fever = feverMultipliers(run, meta, config)
  let instabBonus = 0
  for (const syn of config.synergies) {
    if ((run.producerLevels[syn.producerId] ?? 0) >= syn.minLevel) {
      instabBonus += syn.instabilityRewardBonus ?? 0
    }
  }
  instabBonus += trans.reduce((s, t) => s + (t.instabilityRewardBonus ?? 0), 0)
  instabBonus += skills.reduce((s, n) => s + (n.instabilityRewardBonus ?? 0), 0)
  const instab = instabilityReward(run.instability, instabBonus)
  const buffs = buffMultiplier(run, now, "productionMultiplier", config)
  const region = regionPresenceMultipliers(run, config)
  const boughtGlobal =
    product(upgrades.filter((u) => !u.producerId && !u.producerTag).map((u) => u.productionMultiplier ?? 1)) *
    product(skills.filter((s) => !s.producerTag).map((s) => s.productionMultiplier ?? 1))
  const globalProd =
    product(trans.map((t) => t.productionMultiplier ?? 1)) *
    fever.production *
    instab *
    buffs *
    region.production *
    eventBoostMultiplier(run, "surge", now) *
    eventBoostMultiplier(run, "relay", now) *
    eventBoostMultiplier(run, "gacha", now) *
    gachaStarMultiplier(meta) *
    worldlineMultiplier(meta, config) *
    achievementProductionMultiplier(meta)

  const byProducer: Record<string, number> = {}
  let perSecond = 0
  for (const producer of config.producers) {
    const level = run.producerLevels[producer.id] ?? 0
    if (level <= 0) {
      byProducer[producer.id] = 0
      continue
    }
    let bought = boughtGlobal
    for (const u of upgrades) {
      if (u.productionMultiplier && u.producerId === producer.id) bought *= u.productionMultiplier
      if (u.productionMultiplier && u.producerTag && producer.tags.includes(u.producerTag)) {
        bought *= u.productionMultiplier
      }
    }
    for (const s of skills) {
      if (s.productionMultiplier && s.producerTag && producer.tags.includes(s.producerTag)) {
        bought *= s.productionMultiplier
      }
    }
    let rate = producer.productionPerSecond * level * softStack(bought, config)
    for (const syn of config.synergies) {
      if (
        (run.producerLevels[syn.producerId] ?? 0) >= syn.minLevel &&
        syn.productionTargetId === producer.id &&
        syn.productionBonus
      ) {
        rate *= 1 + syn.productionBonus
      }
    }
    rate *= globalProd
    byProducer[producer.id] = rate
    perSecond += rate
  }
  return { perSecond, byProducer }
}

export function processClick(
  run: RunState,
  meta: MetaState,
  config: GameConfig,
  now: number,
  rng: Rng
): { run: RunState; meta: MetaState; result: ClickResult } {
  if (run.crisisActive) {
    return {
      run,
      meta,
      result: {
        energyGained: 0,
        isCritical: false,
        comboCount: run.combo.count,
        comboMultiplier: run.combo.multiplier,
        feverBonus: 1,
        instabilityDelta: 0,
        fx: "CLICK",
        lightning: false,
        quake: false,
        echo: false,
      },
    }
  }

  const derived = derivedClick(run, meta, config)
  let combo = { ...run.combo, maxCombo: derived.comboMax }
  if (now > combo.expiresAt) combo = { ...combo, count: 0, multiplier: 1 }
  combo.count = Math.min(combo.count + 1, combo.maxCombo)
  combo.multiplier = Math.min(1 + combo.count * config.comboPerStack, config.comboMultiplierCap)
  combo.expiresAt = now + derived.comboWindow * 1000
  if (combo.count > combo.maxCombo) combo.maxCombo = combo.count

  const fever = feverMultipliers(run, meta, config)
  const isCritical = rng() < derived.critChance
  if (isCritical) combo.expiresAt += 250

  let hit =
    derived.click *
    combo.multiplier *
    fever.click *
    eventBoostMultiplier(run, "laser_rush", now) *
    buffMultiplier(run, now, "clickMultiplier", config)
  if (isCritical) hit *= derived.critMult

  const strikes = strikeStats(run, config, meta, now)
  let energy = hit
  const echo = strikes.echoChance > 0 && rng() < strikes.echoChance
  if (echo) energy += hit
  const lightning = strikes.lightningChance > 0 && rng() < strikes.lightningChance
  if (lightning) energy += hit * strikes.lightningMultiplier * (1 + 0.5 * strikes.lightningChains)
  const quake = strikes.quakeMultiplier > 0 && (run.clickCount + 1) % strikes.quakeInterval === 0
  if (quake) energy += hit * strikes.quakeMultiplier
  energy *= mineYieldMultiplier(run, config)

  const feverState = { ...run.fever }
  if (feverRunning(run)) {
    feverState.combo = Math.min(feverState.combo + 1, config.feverComboCap)
    if (isCritical) feverState.critsThisFever += 1
    feverState.finisherReady =
      !feverState.finisherUsed &&
      (feverState.combo >= config.feverComboCap || feverState.critsThisFever >= 5)
    combo.expiresAt += 400
  } else if (feverState.phase === "IDLE" && feverUnlocked(run, config)) {
    const gain = 1 + (isCritical ? 4 : 0) + (combo.count > 0 && combo.count % 10 === 0 ? 6 : 0)
    feverState.gauge = clamp(feverState.gauge + gain, 0, config.feverGaugeMax)
  }

  const nextRun: RunState = {
    ...run,
    coreEnergy: run.coreEnergy + energy,
    lifetimeCoreEnergy: run.lifetimeCoreEnergy + energy,
    combo,
    fever: feverState,
    potions: run.potions,
    clickCount: run.clickCount + 1,
  }
  const nextMeta: MetaState = {
    ...meta,
    totalCoreEnergy: meta.totalCoreEnergy + energy,
    statistics: {
      ...meta.statistics,
      clicks: meta.statistics.clicks + 1,
      crits: meta.statistics.crits + (isCritical ? 1 : 0),
      maxCombo: Math.max(meta.statistics.maxCombo, combo.count),
    },
  }

  return {
    run: refreshObjective(nextRun, nextMeta, config),
    meta: nextMeta,
    result: {
      energyGained: energy,
      isCritical,
      comboCount: combo.count,
      comboMultiplier: combo.multiplier,
      feverBonus: fever.click,
      instabilityDelta: 0,
      fx: isCritical ? "CRITICAL" : feverRunning(run) ? "FEVER_CLICK" : "CLICK",
      lightning,
      quake,
      echo,
    },
  }
}

export function buyPotion(run: RunState, config: GameConfig, potionId: string): { run: RunState; error?: string } {
  const potion = config.potions.find((p) => p.id === potionId)
  if (!potion) return { run, error: "물약을 찾을 수 없습니다." }
  const cost = scaledCost(run, potion.shopCost)
  if (run.coreEnergy < cost) return { run, error: "CORE가 부족합니다." }
  const { wallet: regionCurrency, short } = payCurrencyCosts(run, config, purchaseCurrencyCosts(run, config, potion.shopCost))
  if (short) return { run, error: `${short.name}이(가) 부족합니다.` }
  return {
    run: {
      ...run,
      coreEnergy: run.coreEnergy - cost,
      regionCurrency,
      potions: { ...run.potions, [potionId]: (run.potions[potionId] ?? 0) + 1 },
    },
  }
}

/** Active skill charges cost this many times their catalog price… */
export const ACTIVE_SKILL_PRICE_MULT = 12
/** …or this share of the CORE mined this run (scaled up for pricier skills), whichever is more. */
export const ACTIVE_SKILL_LIFETIME_SHARE = 0.012

/** The cheapest skill's catalog price (LASER FOCUS); the lifetime share scales from it. */
const ACTIVE_SKILL_REFERENCE_COST = 20

/** Price of one active skill charge: it keeps pace with the run instead of going trivial. */
export function activeSkillCost(run: RunState, skill: ActiveSkillDef): number {
  const share = ACTIVE_SKILL_LIFETIME_SHARE * Math.sqrt(skill.shopCost / ACTIVE_SKILL_REFERENCE_COST)
  return Math.ceil(Math.max(scaledCost(run, skill.shopCost * ACTIVE_SKILL_PRICE_MULT), run.lifetimeCoreEnergy * share))
}
export function buyActiveSkillItem(
  run: RunState,
  config: GameConfig,
  skillId: string
): { run: RunState; error?: string } {
  const skill = config.activeSkills.find((s) => s.id === skillId)
  if (!skill) return { run, error: "스킬을 찾을 수 없습니다." }
  const cost = activeSkillCost(run, skill)
  if (run.coreEnergy < cost) return { run, error: "CORE가 부족합니다." }
  const { wallet: regionCurrency, short } = payCurrencyCosts(run, config, purchaseCurrencyCosts(run, config, skill.shopCost))
  if (short) return { run, error: `${short.name}이(가) 부족합니다.` }
  return {
    run: {
      ...run,
      coreEnergy: run.coreEnergy - cost,
      regionCurrency,
      skillItems: { ...run.skillItems, [skillId]: (run.skillItems[skillId] ?? 0) + 1 },
    },
  }
}

/** FEVER stays locked until a circuit with `unlocksFever` is owned (always open if none exists). */
export function feverUnlocked(run: RunState, config: GameConfig): boolean {
  const gates = config.skillNodes.filter((n) => n.unlocksFever)
  return !gates.length || gates.some((n) => run.ownedSkillNodeIds.includes(n.id))
}

export function startFever(
  run: RunState,
  meta: MetaState,
  config: GameConfig,
  source: "GAUGE" | "POTION",
  potionId: string | null
): { run: RunState; error?: string } {
  if (!feverUnlocked(run, config)) return { run, error: "스킬 「Fever Core」에서 FEVER를 해금해야 합니다." }
  if (run.crisisActive) return { run, error: "위기 중에는 FEVER를 열 수 없습니다." }
  if (feverActive(run.fever) || run.fever.phase === "COOL_DOWN") {
    return { run, error: "FEVER가 아직 끝나지 않았습니다." }
  }
  const potion = potionId ? config.potions.find((p) => p.id === potionId) : undefined
  if (source === "POTION") {
    if (!potion) return { run, error: "물약이 없습니다." }
    if ((run.potions[potion.id] ?? 0) <= 0) return { run, error: "물약이 부족합니다." }
  }
  if (source === "GAUGE" && run.fever.gauge < config.feverGaugeMax) {
    return { run, error: "FEVER 게이지가 부족합니다." }
  }
  const duration = feverDurationSeconds(run, meta, config, potion)
  const potions = potion
    ? { ...run.potions, [potion.id]: Math.max(0, (run.potions[potion.id] ?? 0) - 1) }
    : run.potions
  return {
    run: refreshObjective(
      {
        ...run,
        potions,
        feverStarts: run.feverStarts + 1,
        fever: {
          phase: "FEVER",
          remainingTime: duration,
          duration,
          gauge: source === "GAUGE" ? 0 : run.fever.gauge,
          combo: 1,
          maxCombo: config.feverComboCap,
          critsThisFever: 0,
          finisherReady: false,
          finisherUsed: false,
          source,
          potionId,
        },
      },
      meta,
      config
    ),
  }
}

function tryFinisher(run: RunState, meta: MetaState, config: GameConfig, now: number): RunState {
  if (!run.fever.finisherReady || run.fever.finisherUsed) return run
  const snapshot = productionSnapshot(run, meta, config, now)
  const rewardMult =
    ownedUpgrades(run, config).reduce((s, u) => s * (u.finisherReward ?? 1), 1) *
    ownedSkills(run, config).reduce((s, n) => s * (n.finisherReward ?? 1), 1)
  const burst = (snapshot.perSecond * 3 * rewardMult + run.coreEnergy * 0.02) * mineYieldMultiplier(run, config)
  return {
    ...run,
    coreEnergy: run.coreEnergy + burst,
    lifetimeCoreEnergy: run.lifetimeCoreEnergy + burst,
    fever: {
      ...run.fever,
      finisherUsed: true,
      finisherReady: false,
      gauge: clamp(run.fever.gauge + 18, 0, config.feverGaugeMax),
    },
  }
}

export function processTick(
  run: RunState,
  meta: MetaState,
  config: GameConfig,
  now: number
): { run: RunState; meta: MetaState } {
  const dt = Math.max(0, Math.min((now - run.lastTickAt) / 1000, 1))
  if (dt <= 0) return { run: { ...run, lastTickAt: now }, meta }

  let next = pruneEventBoosts({ ...run, lastTickAt: now }, now)
  if (now > next.combo.expiresAt && next.combo.count > 0) {
    next.combo = { ...next.combo, count: 0, multiplier: 1 }
  }
  if (skillClockRunning(next)) {
    next.activeBuffs = next.activeBuffs.filter((b) => b.expiresAt > now)
    const cooldowns: Record<string, number> = {}
    for (const [id, remaining] of Object.entries(next.skillCooldowns)) {
      const left = remaining - dt
      if (left > 0) cooldowns[id] = left
    }
    next.skillCooldowns = cooldowns
  } else if (next.activeBuffs.length) {
    // Outside the mine a running buff keeps its remaining time for the next session.
    const away = Math.max(0, now - run.lastTickAt)
    next.activeBuffs = next.activeBuffs.map((b) => ({ ...b, expiresAt: b.expiresAt + away }))
  }

  if (feverRunning(next)) {
    next.fever = { ...next.fever, remainingTime: next.fever.remainingTime - dt }
    const potion = next.fever.potionId
      ? config.potions.find((p) => p.id === next.fever.potionId)
      : undefined
    if (potion && potion.instabilityPerSecond) {
      next = applyInstabilityDelta(next, potion.instabilityPerSecond * dt)
    }
    const overclock = next.activeBuffs.find((b) => b.id === "overclock")
    if (overclock) {
      const skill = config.activeSkills.find((s) => s.id === "overclock")
      if (skill?.instabilityPerSecond) {
        next = applyInstabilityDelta(next, skill.instabilityPerSecond * dt)
      }
    }
    if (next.fever.remainingTime <= 0.35) next = tryFinisher(next, meta, config, now)
    if (next.fever.remainingTime <= 0) {
      next.fever = {
        ...createInitialFever(),
        phase: "COOL_DOWN",
        remainingTime: config.feverCoolDown,
        gauge: next.fever.gauge,
      }
    }
  } else if (next.fever.phase === "COOL_DOWN") {
    const left = next.fever.remainingTime - dt
    next.fever =
      left <= 0
        ? { ...next.fever, phase: "IDLE", remainingTime: 0 }
        : { ...next.fever, remainingTime: left }
  }

  const snapshot = productionSnapshot(next, meta, config, now)
  const drones = next.crisisActive ? 0 : droneEnergyPerSecond(next, meta, config, now)
  let gained = (snapshot.perSecond + drones) * dt
  if (next.vaultDeposit > 0 && next.vaultReadyAt <= now) {
    const interest = (vaultMultiplier(config) - 1) * worldTreeMultiplier(next, config, "phase_vault", "activityMultiplier")
    const payout = next.vaultDeposit * (1 + interest)
    // The deposit left the bank but was already counted as earned; only the interest is new.
    gained += payout - next.vaultDeposit
    next = { ...next, coreEnergy: next.coreEnergy + next.vaultDeposit, vaultDeposit: 0, vaultReadyAt: 0 }
  }
  next = {
    ...next,
    coreEnergy: next.coreEnergy + gained,
    lifetimeCoreEnergy: next.lifetimeCoreEnergy + gained,
  }
  if (!next.crisisActive) next = applyInstabilityDelta(next, hoardInstabilityPerSecond(next, snapshot.perSecond) * dt)
  if (next.instability >= 100 || next.crisisActive) next = collapseCore(next, now)
  next = tickBoss(next, config, now)
  next = refreshSkillPoints(next, config)
  next = refreshObjective(next, meta, config)
  const nextMeta: MetaState = {
    ...meta,
    totalCoreEnergy: meta.totalCoreEnergy + gained,
  }
  return { run: next, meta: nextMeta }
}

function totalProducerLevels(run: RunState): number {
  return Object.values(run.producerLevels).reduce((s, n) => s + n, 0)
}

function refreshSkillPoints(run: RunState, config: GameConfig): RunState {
  const earned = Math.floor(totalProducerLevels(run) / config.skillPointEveryLevels)
  const available = Math.max(0, earned - run.skillPointsSpent)
  if (available === run.skillPoints) return run
  return { ...run, skillPoints: available }
}

function refreshObjective(run: RunState, meta: MetaState, config: GameConfig): RunState {
  let id = run.currentObjectiveId
  const seen = new Set<string>()
  while (id && !seen.has(id)) {
    seen.add(id)
    const obj = config.objectives.find((o) => o.id === id)
    if (!obj) break
    const done =
      obj.kind === "PRODUCER"
        ? (run.producerLevels[obj.producerId ?? ""] ?? 0) >= obj.target
        : obj.kind === "ENERGY"
          ? run.lifetimeCoreEnergy >= obj.target
          : obj.kind === "FEVER"
            ? run.feverStarts >= obj.target
            : obj.kind === "SKILL"
              ? run.ownedSkillNodeIds.length >= obj.target
              : obj.kind === "POTION"
                ? Object.values(run.potions).reduce((sum, n) => sum + n, 0) >= obj.target
                : meta.rebirthCount >= obj.target
    if (!done || !obj.nextId) break
    const nextObjective = config.objectives.find((o) => o.id === obj.nextId)
    if (nextObjective?.kind === "REBIRTH" && run.lifetimeCoreEnergy < rebirthRequirement(meta, config)) break
    id = obj.nextId
  }
  if (id === run.currentObjectiveId) return run
  return { ...run, currentObjectiveId: id }
}

export function buyProducer(
  run: RunState,
  meta: MetaState,
  config: GameConfig,
  producerId: string,
  count: number | "MAX"
): { run: RunState; error?: string; bought?: number } {
  if (!isProducerUnlocked(run, config, producerId)) {
    return { run, error: "아직 잠겨 있습니다." }
  }
  const level = run.producerLevels[producerId] ?? 0
  const n = count === "MAX" ? maxAffordable(config, producerId, level, run.coreEnergy, run.costScale) : count
  if (n <= 0) return { run, error: "CORE가 부족합니다." }
  const cost = producerBulkCost(config, producerId, level, n, run.costScale)
  if (run.coreEnergy < cost) return { run, error: "CORE가 부족합니다." }
  const next = refreshSkillPoints(
    {
      ...run,
      coreEnergy: run.coreEnergy - cost,
      producerLevels: { ...run.producerLevels, [producerId]: level + n },
    },
    config
  )
  return { run: refreshObjective(next, meta, config), bought: n }
}

/**
 * Advanced purchases (upgrades, skill circuits, shop items) also cost world currencies: a share
 * of the price in the newest world normally open by then, and a smaller share in the world
 * before it. Older-world shortfalls are covered by newer wallets (see `payRegionCurrency`), so a
 * player who has moved on is never sent back to grind.
 */
/** An item needs a world's currency once it costs at least this share of the CORE that opens the world in this worldline. */
const REGION_CURRENCY_UNLOCK_LEAD = 0.05
/** Newest world first. */
const REGION_CURRENCY_COST_SHARES = [0.1, 0.05]
/**
 * Off: with currencies minted at a trickle until a world's own tree raises the rate, a surcharge
 * on CORE purchases would stall the main climb. Kept switchable for tuning.
 */
const WORLD_CURRENCY_SURCHARGE = false

export type CurrencyCost = { regionId: string; name: string; icon: string; amount: number }

export function purchaseCurrencyCosts(run: RunState, config: GameConfig, baseCost: number): CurrencyCost[] {
  // World currencies now only pay for their own world's skill tree and the Relic Vault.
  if (!WORLD_CURRENCY_SURCHARGE) return []
  const cost = scaledCost(run, baseCost)
  return config.regions
    .filter((r) => r.currency && !r.isHome && regionUnlockThreshold(run, config, r) * REGION_CURRENCY_UNLOCK_LEAD <= cost)
    .slice(-REGION_CURRENCY_COST_SHARES.length)
    .reverse()
    .map((r, i) => ({
      regionId: r.id,
      name: r.currency!.name,
      icon: r.currency!.icon,
      amount: Math.ceil(cost * REGION_CURRENCY_COST_SHARES[i]),
    }))
}

export function upgradeCurrencyCosts(run: RunState, config: GameConfig, upgrade: UpgradeDef): CurrencyCost[] {
  return purchaseCurrencyCosts(run, config, upgrade.cost)
}

/**
 * Pays every currency cost from a copy of the wallet, oldest world first so its shortfall can
 * still draw on the newer wallets. Returns the new wallet, or the first currency that ran short.
 */
export function payCurrencyCosts(
  run: RunState,
  config: GameConfig,
  costs: CurrencyCost[],
): { wallet: Record<string, number>; short?: CurrencyCost } {
  const wallet = { ...run.regionCurrency }
  const order = config.regions.map((r) => r.id)
  for (const c of [...costs].sort((a, b) => order.indexOf(a.regionId) - order.indexOf(b.regionId))) {
    if (!payRegionCurrency(wallet, config, c.regionId, c.amount)) return { wallet: { ...run.regionCurrency }, short: c }
  }
  return { wallet }
}

export function regionCurrencyBalance(run: RunState, regionId: string): number {
  return run.regionCurrency?.[regionId] ?? 0
}

/**
 * CORE earned while standing in a region also mints that region's currency: a small share at
 * first (`regionCurrencyRate`), raised only by that world's own skill tree.
 */
export function accrueRegionCurrency(prev: RunState, next: RunState, config: GameConfig): RunState {
  const gained = next.lifetimeCoreEnergy - prev.lifetimeCoreEnergy
  if (!(gained > 0)) return next
  const region = config.regions.find((r) => r.id === prev.currentRegionId)
  if (!region?.currency) return next
  const minted = gained * regionCurrencyRate(next, config, region.id)
  return {
    ...next,
    regionCurrency: { ...next.regionCurrency, [region.id]: regionCurrencyBalance(next, region.id) + minted },
  }
}

export function regionCurrencyRate(run: RunState, config: GameConfig, regionId: string): number {
  return (config.regionCurrencyRate ?? 1) * worldTreeMultiplier(run, config, regionId, "currencyMultiplier")
}

/**
 * Spends `amount` of a region's currency; any shortfall is covered by newer worlds' currencies
 * (newest last), so a player who has moved on is never sent back to grind an old world.
 * Mutates `wallet` only when the whole amount can be paid.
 */
export function payRegionCurrency(wallet: Record<string, number>, config: GameConfig, regionId: string, amount: number): boolean {
  const order = config.regions.filter((r) => r.currency && !r.isHome)
  const start = order.findIndex((r) => r.id === regionId)
  if (start < 0) return false
  const sources = order.slice(start).map((r) => r.id)
  if (sources.reduce((sum, id) => sum + (wallet[id] ?? 0), 0) < amount) return false
  let left = amount
  for (const id of sources) {
    const take = Math.min(left, wallet[id] ?? 0)
    wallet[id] = (wallet[id] ?? 0) - take
    left -= take
    if (left <= 0) break
  }
  return true
}

export function buyUpgrade(
  run: RunState,
  config: GameConfig,
  upgradeId: string
): { run: RunState; error?: string } {
  const upgrade = config.upgrades.find((u) => u.id === upgradeId)
  if (!upgrade) return { run, error: "업그레이드가 없습니다." }
  if (run.ownedUpgradeIds.includes(upgradeId)) return { run, error: "이미 보유함" }
  if (upgrade.unlockProducerId && (run.producerLevels[upgrade.unlockProducerId] ?? 0) <= 0) {
    return { run, error: "조건 미달" }
  }
  if (upgrade.unlockFeverStarts && run.feverStarts < upgrade.unlockFeverStarts) {
    return { run, error: "조건 미달" }
  }
  const cost = scaledCost(run, upgrade.cost)
  if (run.coreEnergy < cost) return { run, error: "CORE가 부족합니다." }
  const { wallet: regionCurrency, short } = payCurrencyCosts(run, config, upgradeCurrencyCosts(run, config, upgrade))
  if (short) return { run, error: `${short.name}이(가) 부족합니다.` }
  return {
    run: {
      ...run,
      coreEnergy: run.coreEnergy - cost,
      regionCurrency,
      ownedUpgradeIds: [...run.ownedUpgradeIds, upgradeId],
    },
  }
}

/** A circuit appears once all of its prerequisites are owned (roots are always shown). */
export function isSkillNodeVisible(run: RunState, node: SkillNodeDef): boolean {
  if (run.ownedSkillNodeIds.includes(node.id)) return true
  return (node.requires ?? []).every((id) => run.ownedSkillNodeIds.includes(id))
}

export function buySkillNode(
  run: RunState,
  config: GameConfig,
  nodeId: string
): { run: RunState; error?: string } {
  const node = config.skillNodes.find((n) => n.id === nodeId)
  if (!node) return { run, error: "스킬이 없습니다." }
  if (run.ownedSkillNodeIds.includes(nodeId)) return { run, error: "이미 보유함" }
  if ((node.requires ?? []).some((id) => !run.ownedSkillNodeIds.includes(id))) {
    return { run, error: "선행 스킬이 필요합니다." }
  }
  const cost = scaledCost(run, node.cost)
  if (run.coreEnergy < cost) return { run, error: "CORE가 부족합니다." }
  const { wallet: regionCurrency, short } = payCurrencyCosts(run, config, purchaseCurrencyCosts(run, config, node.cost))
  if (short) return { run, error: `${short.name}이(가) 부족합니다.` }
  return {
    run: {
      ...run,
      coreEnergy: run.coreEnergy - cost,
      regionCurrency,
      ownedSkillNodeIds: [...run.ownedSkillNodeIds, nodeId],
    },
  }
}

export function activateSkill(
  run: RunState,
  meta: MetaState,
  config: GameConfig,
  skillId: string,
  now: number
): { run: RunState; error?: string } {
  if (run.crisisActive) return { run, error: "위기 중에는 일부 스킬을 쓸 수 없습니다." }
  if (!skillClockRunning(run)) return { run, error: "스킬은 광산 안에서만 쓸 수 있습니다." }
  const skill = config.activeSkills.find((s) => s.id === skillId)
  if (!skill) return { run, error: "스킬이 없습니다." }
  if ((run.skillItems[skillId] ?? 0) <= 0) return { run, error: "스킬이 부족합니다." }
  if ((run.skillCooldowns[skillId] ?? 0) > 0) return { run, error: "쿨다운 중입니다." }
  let next = {
    ...run,
    skillItems: { ...run.skillItems, [skillId]: Math.max(0, (run.skillItems[skillId] ?? 0) - 1) },
    skillCooldowns: { ...run.skillCooldowns, [skillId]: skill.cooldown },
  }
  if (skill.instabilityDelta) next = applyInstabilityDelta(next, skill.instabilityDelta)
  if (skill.duration > 0) {
    next.activeBuffs = [
      ...next.activeBuffs.filter((b) => b.id !== skillId),
      { id: skillId, expiresAt: now + skill.duration * 1000 },
    ]
  }
  if (skill.energyBurstSeconds) {
    const snapshot = productionSnapshot(next, meta, config, now)
    const burst = snapshot.perSecond * skill.energyBurstSeconds
    next = {
      ...next,
      coreEnergy: next.coreEnergy + burst,
      lifetimeCoreEnergy: next.lifetimeCoreEnergy + burst,
    }
  }
  return { run: next }
}

export function resolveCrisis(
  run: RunState,
  meta: MetaState,
  config: GameConfig,
  choice: CrisisChoice,
  now: number,
  rng: Rng
): { run: RunState; meta: MetaState } {
  if (!run.crisisActive) return { run, meta }
  let next = { ...run, crisisActive: false }
  if (choice === "STABILIZE") {
    next = applyInstabilityDelta({ ...next, coreEnergy: next.coreEnergy * 0.8 }, -60)
  } else if (choice === "RISK_IT") {
    const reward = next.coreEnergy * 0.3
    next = {
      ...next,
      coreEnergy: next.coreEnergy + reward,
      lifetimeCoreEnergy: next.lifetimeCoreEnergy + reward,
    }
    next = applyInstabilityDelta(next, rng() < 0.35 ? -80 : -15)
  } else {
    const snapshot = productionSnapshot(next, meta, config, now)
    const burst = snapshot.perSecond * 8 + next.coreEnergy * 0.15
    next = {
      ...next,
      coreEnergy: next.coreEnergy + burst,
      lifetimeCoreEnergy: next.lifetimeCoreEnergy + burst,
    }
    next = applyInstabilityDelta(next, rng() < 0.5 ? -30 : -70)
  }
  return { run: next, meta }
}

export function applyRebirth(
  run: RunState,
  meta: MetaState,
  config: GameConfig,
  buffId: string,
  now: number
): { run: RunState; meta: MetaState; error?: string } {
  if (meta.gameCompleted) return { run, meta, error: "완료된 기록입니다." }
  if (!canRebirth(run, meta, config)) {
    return { run, meta, error: "아직 REBIRTH 조건이 아닙니다." }
  }
  const buff = config.transcendence.find((t) => t.id === buffId)
  if (!buff) return { run, meta, error: "초월 버프가 없습니다." }
  if (meta.transcendenceIds.includes(buffId)) return { run, meta, error: "이미 걸어 본 세계선입니다." }
  const nextMeta: MetaState = {
    ...meta,
    rebirthCount: meta.rebirthCount + 1,
    transcendenceIds: [...meta.transcendenceIds, buffId],
    statistics: { ...meta.statistics, feverStarts: meta.statistics.feverStarts + run.feverStarts },
  }
  const fresh = createInitialRun(now, nextMeta, config)
  const carried = ownedSkills(run, config).reduce((sum, n) => sum + (n.startingEnergy ?? 0), 0) * fresh.costScale
  return {
    run: {
      ...fresh,
      coreEnergy: fresh.coreEnergy + carried,
      lifetimeCoreEnergy: fresh.lifetimeCoreEnergy + carried,
    },
    meta: nextMeta,
  }
}

/** Each worldline buff is walked once; after the last one the path leads to Core Heart instead. */
export function canRebirth(run: RunState, meta: MetaState, config: GameConfig): boolean {
  if (new Set(meta.transcendenceIds).size >= config.transcendence.length) return false
  return run.lifetimeCoreEnergy >= rebirthRequirement(meta, config)
}

function vaultMultiplier(config: GameConfig): number {
  return config.regions.find((r) => r.activity?.kind === "PHASE_DEPOSIT")?.activity?.multiplier ?? 1
}

/** Region activity is off cooldown (it may still need the player to stand in the region). */
export function regionActivityReady(run: RunState, regionId: string, now: number): boolean {
  return (run.regionCooldowns[regionId] ?? 0) <= now
}

/** Use the current region's activity. The player must be standing in that region. */
export function activateRegion(
  run: RunState,
  meta: MetaState,
  config: GameConfig,
  regionId: string,
  now: number
): { run: RunState; meta: MetaState; error?: string } {
  const region = config.regions.find((r) => r.id === regionId)
  const activity = region?.activity
  if (!region || !activity) return { run, meta, error: "이 지역에는 활동이 없습니다." }
  if (run.currentRegionId !== regionId) return { run, meta, error: `${region.name}에 있어야 합니다.` }
  if (run.crisisActive) return { run, meta, error: "위기 중에는 사용할 수 없습니다." }
  if (!regionActivityReady(run, regionId, now)) {
    const secs = Math.ceil(((run.regionCooldowns[regionId] ?? 0) - now) / 1000)
    return { run, meta, error: `${activity.name} 재사용 대기 ${secs}초` }
  }
  let next: RunState = {
    ...run,
    regionCooldowns: { ...run.regionCooldowns, [regionId]: now + activity.cooldownSec * 1000 },
  }
  let nextMeta = meta
  const until = now + (activity.durationSec ?? 0) * 1000
  switch (activity.kind) {
    case "PRODUCTION_BOOST":
      next.eventBoosts = [
        ...next.eventBoosts.filter((b) => b.id !== "relay"),
        { id: "relay", multiplier: 1 + ((activity.multiplier ?? 1) - 1) * worldTreeMultiplier(run, config, regionId, "activityMultiplier"), expiresAt: until },
      ]
      break
    case "PHASE_DEPOSIT": {
      if (next.vaultDeposit > 0) return { run, meta, error: "이미 예치 중입니다." }
      const amount = Math.floor(next.coreEnergy * (activity.depositShare ?? 0.5))
      if (amount <= 0) return { run, meta, error: "예치할 CORE가 없습니다." }
      next = { ...next, coreEnergy: next.coreEnergy - amount, vaultDeposit: amount, vaultReadyAt: until }
      break
    }
    case "LIGHTNING_STORM":
      next.lightningStormUntil = now + (activity.durationSec ?? 0) * 1000 * worldTreeMultiplier(run, config, regionId, "activityMultiplier")
      break
    case "DRONE_SWARM":
      next.droneSwarmUntil = until
      break
    case "PRODUCTION_BURST": {
      const perSecond = productionSnapshot(next, meta, config, now).perSecond
      const burst = perSecond * (activity.productionSeconds ?? 0) * worldTreeMultiplier(run, config, regionId, "activityMultiplier")
      next = { ...next, coreEnergy: next.coreEnergy + burst, lifetimeCoreEnergy: next.lifetimeCoreEnergy + burst }
      nextMeta = { ...meta, totalCoreEnergy: meta.totalCoreEnergy + burst }
      break
    }
  }
  return { run: next, meta: nextMeta }
}

/** Why the region's field challenge can't start right now, or undefined when it can. */
export function regionChallengeError(run: RunState, config: GameConfig, regionId: string, now: number): string | undefined {
  const region = config.regions.find((r) => r.id === regionId)
  const challenge = region?.challenge
  if (!region || !challenge) return "이 지역에는 도전 과제가 없습니다."
  if (run.currentRegionId !== regionId) return `${region.name}에 있어야 합니다.`
  if (run.crisisActive) return "위기 중에는 도전할 수 없습니다."
  const readyAt = run.challengeCooldowns[regionId] ?? 0
  if (readyAt > now) return `${challenge.name} 재도전 대기 ${Math.ceil((readyAt - now) / 1000)}초`
  return undefined
}

/**
 * Settle a finished field challenge. `score` is 0..1 (share of targets hit); a perfect run pays
 * `rewardSeconds` of current production. Starts the cooldown whatever the score.
 */
export function claimRegionChallenge(
  run: RunState,
  meta: MetaState,
  config: GameConfig,
  regionId: string,
  score: number,
  now: number
): { run: RunState; meta: MetaState; reward: number; error?: string } {
  const error = regionChallengeError(run, config, regionId, now)
  if (error) return { run, meta, reward: 0, error }
  const challenge = config.regions.find((r) => r.id === regionId)!.challenge!
  const ratio = Number.isFinite(score) ? clamp(score, 0, 1) : 0
  const reward =
    productionSnapshot(run, meta, config, now).perSecond * challenge.rewardSeconds * ratio * worldTreeMultiplier(run, config, regionId, "challengeMultiplier")
  return {
    run: refreshObjective(
      {
        ...run,
        coreEnergy: run.coreEnergy + reward,
        lifetimeCoreEnergy: run.lifetimeCoreEnergy + reward,
        challengeCooldowns: { ...run.challengeCooldowns, [regionId]: now + challenge.cooldownSec * 1000 },
      },
      meta,
      config
    ),
    meta: { ...meta, totalCoreEnergy: meta.totalCoreEnergy + reward },
    reward,
  }
}

/**
 * Lifetime CORE that opens a world in this worldline. Worlds are late-run events: the catalog
 * value is set against the first worldline's rebirth goal and grows with that goal, so each
 * world opens at the same share of every worldline.
 */
export function regionUnlockThreshold(run: RunState, config: GameConfig, region: { unlockAtLifetimeEnergy: number }): number {
  return region.unlockAtLifetimeEnergy * config.rebirthGrowth ** Math.max(0, run.currentWorldLine - 1)
}

export function isRegionUnlocked(run: RunState, config: GameConfig, regionId: string): boolean {
  const region = config.regions.find((r) => r.id === regionId)
  if (!region) return false
  if ((region.requiresRebirths ?? 0) > run.currentWorldLine - 1) return false
  return run.lifetimeCoreEnergy >= regionUnlockThreshold(run, config, region)
}

export function homeRegionId(config: GameConfig): string {
  return config.regions.find((r) => r.isHome)?.id ?? config.regions[0]?.id ?? "core_chamber"
}

export const MINE_HOME_ONLY_ERROR = "광산은 Core Mine에서만 입장할 수 있습니다."

/** The timed mine exists only in the home region; other regions run their own activity. */
export function regionHasMine(run: RunState, config: GameConfig): boolean {
  return run.currentRegionId === homeRegionId(config)
}

export function travelToRegion(
  run: RunState,
  config: GameConfig,
  regionId: string
): { run: RunState; error?: string } {
  const region = config.regions.find((r) => r.id === regionId)
  if (!region) return { run, error: "지역을 찾을 수 없습니다." }
  if (!isRegionUnlocked(run, config, regionId)) return { run, error: "아직 잠겨 있습니다." }
  if (run.currentRegionId === regionId) return { run, error: "이미 이 지역입니다." }
  return { run: { ...run, currentRegionId: regionId, boss: null } }
}

/** Records a region visit; `firstVisit` is true only the first time the region is entered. */
export function markRegionVisited(meta: MetaState, regionId: string): { meta: MetaState; firstVisit: boolean } {
  if (meta.visitedRegionIds.includes(regionId)) return { meta, firstVisit: false }
  return { meta: { ...meta, visitedRegionIds: [...meta.visitedRegionIds, regionId] }, firstVisit: true }
}

export function returnHomeRegion(run: RunState, config: GameConfig): { run: RunState; error?: string } {
  const homeId = homeRegionId(config)
  if (run.currentRegionId === homeId) return { run, error: "이미 Core Mine에 있습니다." }
  return { run: { ...run, currentRegionId: homeId, boss: null } }
}

/**
 * Resume after a gap (reload, hidden tab): nothing is earned while away.
 * Timed state (fever, combo, buffs, boosts) lapses and the tick clock restarts at `now`.
 */
export function resumeAfterGap(run: RunState): RunState {
  return {
    ...run,
    fever: run.fever.phase === "IDLE" ? run.fever : { ...createInitialFever(), gauge: run.fever.gauge },
    combo: createInitialCombo(),
    activeBuffs: [],
    eventBoosts: [],
    boss: null,
  }
}

export function grantAdminEnergy(run: RunState, amount: number): RunState {
  return {
    ...run,
    coreEnergy: run.coreEnergy + amount,
    lifetimeCoreEnergy: run.lifetimeCoreEnergy + amount,
  }
}

export function sanitizeSave(raw: unknown, config: GameConfig, now: number): SaveData {
  const fallback = createInitialSave(now, config)
  if (!raw || typeof raw !== "object") return fallback
  const data = raw as Partial<SaveData>
  try {
    const run = data.runState
    const meta = data.metaState
    // Missing or non-finite numbers fall back to the initial run's defaults below; only a
    // save without run/meta objects is unrecoverable.
    if (!run || !meta || typeof run !== "object" || typeof meta !== "object") return fallback
    return {
      schemaVersion: config.schemaVersion,
      savedAt: typeof data.savedAt === "number" ? data.savedAt : now,
      settings: {
        muted: Boolean(data.settings?.muted),
        musicMuted: Boolean(data.settings?.musicMuted),
        musicVolume:
          typeof data.settings?.musicVolume === "number" && Number.isFinite(data.settings.musicVolume)
            ? clamp(data.settings.musicVolume, 0, 1)
            : DEFAULT_MUSIC_VOLUME,
        gameStarted:
          Boolean((data.settings as { gameStarted?: boolean } | undefined)?.gameStarted) ||
          Boolean(data.settings?.introSeen) ||
          meta.statistics?.clicks > 0 ||
          run.lifetimeCoreEnergy > 0,
        introSeen: Boolean(data.settings?.introSeen) || meta.statistics?.clicks > 0 || run.lifetimeCoreEnergy > 0,
        tutorialSeen:
          Boolean((data.settings as { tutorialSeen?: boolean } | undefined)?.tutorialSeen) ||
          Boolean(data.settings?.introSeen) ||
          meta.statistics?.clicks > 0 ||
          run.lifetimeCoreEnergy > 0,
        playSurface:
          (data.settings as { playSurface?: string } | undefined)?.playSurface === "mine" ? "mine" : "hub",
      },
      metaState: {
        ...createInitialMeta(),
        ...meta,
        transcendenceIds: Array.isArray(meta.transcendenceIds) ? meta.transcendenceIds.filter((id) => typeof id === "string") : [],
        statistics: { ...createInitialMeta().statistics, ...meta.statistics },
        achievementIds: Array.isArray(meta.achievementIds)
          ? meta.achievementIds.filter((id) => typeof id === "string")
          : [],
        visitedRegionIds: Array.isArray(meta.visitedRegionIds)
          ? meta.visitedRegionIds.filter((id) => typeof id === "string")
          : [],
        gameCompleted: Boolean(meta.gameCompleted),
        completedAt: typeof meta.completedAt === "number" ? meta.completedAt : null,
        bossDefeated: Boolean(meta.bossDefeated),
        monstersSlain: typeof meta.monstersSlain === "number" ? meta.monstersSlain : 0,
        relicLevels: sanitizeRelicLevels(meta.relicLevels, config),
        gachaPity: nonNegativeInt(meta.gachaPity),
        gachaPulls: nonNegativeInt(meta.gachaPulls),
        gachaStars: nonNegativeInt(meta.gachaStars),
      },
      runState: {
        ...createInitialRun(now, createInitialMeta(), config),
        ...run,
        producerLevels: { ...Object.fromEntries(config.producers.map((p) => [p.id, 0])), ...run.producerLevels },
        potions: { ...run.potions },
        skillItems: { ...(run.skillItems ?? {}) },
        ownedUpgradeIds: Array.isArray(run.ownedUpgradeIds) ? run.ownedUpgradeIds : [],
        ownedSkillNodeIds: Array.isArray(run.ownedSkillNodeIds) ? run.ownedSkillNodeIds : [],
        combo: { ...createInitialCombo(), ...run.combo },
        fever: { ...createInitialFever(), ...run.fever },
        activeBuffs: Array.isArray(run.activeBuffs) ? (run.activeBuffs as TimedBuff[]) : [],
        lastTickAt: typeof run.lastTickAt === "number" ? run.lastTickAt : now,
        mineSessionEndsAt: typeof run.mineSessionEndsAt === "number" ? run.mineSessionEndsAt : 0,
        minePausedRemainMs: typeof run.minePausedRemainMs === "number" ? run.minePausedRemainMs : 0,
        mineCooldownUntil: typeof run.mineCooldownUntil === "number" ? run.mineCooldownUntil : 0,
        mineSessionCoreAtEnter:
          typeof run.mineSessionCoreAtEnter === "number" ? run.mineSessionCoreAtEnter : 0,
        mineSessionDurationMs:
          typeof run.mineSessionDurationMs === "number" ? run.mineSessionDurationMs : 0,
        eventBoosts: Array.isArray(run.eventBoosts) ? run.eventBoosts : [],
        drillOverdriveUntil: typeof run.drillOverdriveUntil === "number" ? run.drillOverdriveUntil : 0,
        drillOverdriveReadyAt: typeof run.drillOverdriveReadyAt === "number" ? run.drillOverdriveReadyAt : 0,
        regionCooldowns:
          run.regionCooldowns && typeof run.regionCooldowns === "object" ? { ...run.regionCooldowns } : {},
        challengeCooldowns:
          run.challengeCooldowns && typeof run.challengeCooldowns === "object" ? { ...run.challengeCooldowns } : {},
        monsterRespawnAt:
          run.monsterRespawnAt && typeof run.monsterRespawnAt === "object" ? { ...run.monsterRespawnAt } : {},
        drillGauge: typeof run.drillGauge === "number" ? Math.min(1, Math.max(0, run.drillGauge)) : 0,
        drillCooldownUntil: typeof run.drillCooldownUntil === "number" ? run.drillCooldownUntil : 0,
        boss: null,
        costScale:
          typeof run.costScale === "number" && run.costScale > 0
            ? run.costScale
            : worldlineCostScale({ ...createInitialMeta(), ...meta }, config),
        regionCurrency: Object.fromEntries(
          Object.entries(run.regionCurrency && typeof run.regionCurrency === "object" ? run.regionCurrency : {}).filter(
            ([, v]) => typeof v === "number" && Number.isFinite(v) && v >= 0,
          ),
        ),
        worldTreeIds: Array.isArray(run.worldTreeIds)
          ? run.worldTreeIds.filter((id) => typeof id === "string" && (config.worldTrees ?? []).some((n) => n.id === id))
          : [],
        gear: {
          weapon: Number.isInteger(run.gear?.weapon) ? Math.max(0, run.gear!.weapon) : 0,
          armor: Number.isInteger(run.gear?.armor) ? Math.max(0, run.gear!.armor) : 0,
          helmet: Number.isInteger(run.gear?.helmet) ? Math.max(0, run.gear!.helmet!) : 0,
          amulet: Number.isInteger(run.gear?.amulet) ? Math.max(0, run.gear!.amulet!) : 0,
        },
        // A reload walks you back out of any lair fight; shields keep running.
        lair: null,
        monsterShieldUntil: Object.fromEntries(
          Object.entries(run.monsterShieldUntil && typeof run.monsterShieldUntil === "object" ? run.monsterShieldUntil : {}).filter(
            ([, v]) => typeof v === "number" && Number.isFinite(v),
          ),
        ),
        currentRegionId: (() => {
          const fallback = homeRegionId(config)
          const id = typeof run.currentRegionId === "string" ? run.currentRegionId : fallback
          return config.regions.some((r) => r.id === id) ? id : fallback
        })(),
      },
    }
  } catch {
    return fallback
  }
}

/* ---------- Region monsters ---------- */

export function monsterAlive(run: RunState, regionId: string, now: number): boolean {
  return (run.monsterRespawnAt[regionId] ?? 0) <= now
}

/** Tap the region's roaming monster: it dies, drops CORE, and returns after `respawnSec`. */
export function slayMonster(
  run: RunState,
  meta: MetaState,
  config: GameConfig,
  regionId: string,
  now: number,
): { run: RunState; meta: MetaState; reward: number; error?: string } {
  const region = config.regions.find((r) => r.id === regionId)
  const monster = region?.monster
  if (!region || !monster) return { run, meta, reward: 0, error: "이 지역에는 몬스터가 없습니다." }
  if (run.currentRegionId !== regionId) return { run, meta, reward: 0, error: `${region.name}에 있어야 합니다.` }
  if (!monsterAlive(run, regionId, now)) return { run, meta, reward: 0, error: "아직 돌아오지 않았습니다." }
  const perSecond = productionSnapshot(run, meta, config, now).perSecond
  const skills = ownedSkills(run, config)
  const rewardMul =
    skills.reduce((m, n) => m * (n.monsterRewardMultiplier ?? 1), 1) * worldTreeMultiplier(run, config, regionId, "monsterMultiplier")
  // Same cooldown cuts as the mine re-entry and the drill, plus hunting-specific ones.
  const respawnSec = Math.max(5, monster.respawnSec - skills.reduce((s, n) => s + (n.monsterRespawnReduce ?? 0), 0))
  // Hunting grounds are the region's main income, so their kills pay a much bigger click floor.
  const clickFloor = region.huntMode ? 150 : 25
  const reward = (perSecond * monster.rewardSeconds + derivedClick(run, meta, config).click * clickFloor) * rewardMul
  return {
    run: {
      ...run,
      coreEnergy: run.coreEnergy + reward,
      lifetimeCoreEnergy: run.lifetimeCoreEnergy + reward,
      monsterRespawnAt: { ...run.monsterRespawnAt, [regionId]: now + respawnSec * 1000 },
    },
    meta: { ...meta, totalCoreEnergy: meta.totalCoreEnergy + reward, monstersSlain: (meta.monstersSlain ?? 0) + 1 },
    reward,
  }
}

/* ---------- Region core drilling ---------- */

/** Taps needed to fill the drill gauge. */
export const DRILL_TAPS = 25
const DRILL_MIN_TAPS = 8
const DRILL_MIN_COOLDOWN_MS = 5_000

function ownedUpgradeSum(run: RunState, config: GameConfig, field: "drillCooldownReduceSec" | "drillTapsReduce"): number {
  return config.upgrades.reduce((s, u) => s + (run.ownedUpgradeIds.includes(u.id) ? (u[field] ?? 0) : 0), 0)
}

/** Taps to fill the drill gauge; drill-speed upgrades lower it. */
export function drillTaps(run: RunState, config: GameConfig): number {
  return Math.max(DRILL_MIN_TAPS, DRILL_TAPS - ownedUpgradeSum(run, config, "drillTapsReduce"))
}

/** Cooldown after a bore: the shared re-entry cooldown minus drill coolant upgrades. */
export function drillCooldownMs(run: RunState, config: GameConfig): number {
  const cut = ownedUpgradeSum(run, config, "drillCooldownReduceSec") * 1000
  return Math.max(DRILL_MIN_COOLDOWN_MS, referenceCooldownMs(run, config) - cut)
}

/**
 * One tap on the region drill rig. Fills the gauge; the tap that fills it bores the vein:
 * pays 90s of production plus a click-based floor, empties the gauge and starts the cooldown.
 */
export function drillStrike(
  run: RunState,
  meta: MetaState,
  config: GameConfig,
  now: number,
): { run: RunState; meta: MetaState; reward: number; error?: string } {
  if (run.drillCooldownUntil > now) {
    return { run, meta, reward: 0, error: `시추 장비 냉각 중 · ${Math.ceil((run.drillCooldownUntil - now) / 1000)}초` }
  }
  const gauge = Math.min(1, run.drillGauge + 1 / drillTaps(run, config))
  if (gauge < 1 - 1e-9) return { run: { ...run, drillGauge: gauge }, meta, reward: 0 }
  const perSecond = productionSnapshot(run, meta, config, now).perSecond
  const reward = perSecond * 90 + derivedClick(run, meta, config).click * 60
  return {
    run: {
      ...run,
      drillGauge: 0,
      drillCooldownUntil: now + drillCooldownMs(run, config),
      coreEnergy: run.coreEnergy + reward,
      lifetimeCoreEnergy: run.lifetimeCoreEnergy + reward,
    },
    meta: { ...meta, totalCoreEnergy: meta.totalCoreEnergy + reward },
    reward,
  }
}

/* ---------- Core guardian ---------- */

export function startBossFight(run: RunState, config: GameConfig, now: number): { run: RunState; error?: string } {
  const region = currentRegionDef(run, config)
  const boss = region?.boss
  if (!region || !boss) return { run, error: "여기에는 수호자가 없습니다." }
  if (run.crisisActive) return { run, error: "위기 중에는 싸울 수 없습니다." }
  if (run.boss) return { run }
  return {
    run: {
      ...run,
      boss: {
        regionId: region.id,
        hp: boss.hp,
        maxHp: boss.hp,
        playerHp: boss.playerHp,
        playerMaxHp: boss.playerHp,
        endsAt: now + boss.timeLimitSec * 1000,
        nextAttackAt: now + boss.attackEverySec * 1000,
      },
    },
  }
}

/** One strike on the guardian: damage equals the CORE the strike would mine. */
export function strikeBoss(
  run: RunState,
  meta: MetaState,
  config: GameConfig,
  now: number,
  rng: Rng,
): { run: RunState; meta: MetaState; damage: number; critical: boolean; defeated: boolean } {
  const fight = run.boss
  if (!fight || fight.hp <= 0 || now >= fight.endsAt || fight.playerHp <= 0) {
    return { run, meta, damage: 0, critical: false, defeated: false }
  }
  const hit = processClick(run, meta, config, now, rng)
  const damage = hit.result.energyGained * ownedSkills(run, config).reduce((m, n) => m * (n.bossDamageMultiplier ?? 1), 1)
  const hp = Math.max(0, fight.hp - damage)
  const defeated = hp <= 0
  return {
    run: { ...hit.run, boss: defeated ? null : { ...fight, hp } },
    meta: defeated ? { ...hit.meta, bossDefeated: true } : hit.meta,
    damage,
    critical: hit.result.isCritical,
    defeated,
  }
}

/** Guardian attacks on its timer; the fight ends when the player falls or time runs out. */
export function tickBoss(run: RunState, config: GameConfig, now: number): RunState {
  const fight = run.boss
  if (!fight) return run
  const def = config.regions.find((r) => r.id === fight.regionId)?.boss
  if (!def || now >= fight.endsAt || run.currentRegionId !== fight.regionId) return { ...run, boss: null }
  let { playerHp, nextAttackAt } = fight
  while (now >= nextAttackAt && playerHp > 0) {
    playerHp -= def.attackDamage
    nextAttackAt += def.attackEverySec * 1000
  }
  if (playerHp <= 0) return { ...run, boss: null }
  if (playerHp === fight.playerHp) return run
  return { ...run, boss: { ...fight, playerHp, nextAttackAt } }
}

export type { ActiveSkillDef }

function sanitizeRelicLevels(raw: unknown, config: GameConfig): Record<string, number> {
  if (!raw || typeof raw !== "object") return {}
  const out: Record<string, number> = {}
  for (const relic of config.relics ?? []) {
    const v = (raw as Record<string, unknown>)[relic.id]
    if (typeof v === "number" && Number.isFinite(v) && v > 0) out[relic.id] = Math.min(relic.maxLevel, Math.floor(v))
  }
  return out
}

function nonNegativeInt(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0
}

/* ---------- World skill trees ---------- */

type WorldTreeEffect = "currencyMultiplier" | "presenceMultiplier" | "activityMultiplier" | "challengeMultiplier" | "monsterMultiplier"

export function worldTreeNodes(config: GameConfig, regionId: string): WorldTreeNodeDef[] {
  return (config.worldTrees ?? []).filter((n) => n.regionId === regionId)
}

export function worldTreeOwned(run: RunState, nodeId: string): boolean {
  return (run.worldTreeIds ?? []).includes(nodeId)
}

/** Product of one effect over the world's bought nodes (1 when none). */
export function worldTreeMultiplier(run: RunState, config: GameConfig, regionId: string, effect: WorldTreeEffect): number {
  const owned = run.worldTreeIds
  if (!owned?.length) return 1
  let m = 1
  for (const n of config.worldTrees ?? []) if (n.regionId === regionId && owned.includes(n.id)) m *= n[effect] ?? 1
  return m
}

/** Price in the world's own currency; grows with the worldline like the world's unlock threshold. */
export function worldTreeNodeCost(run: RunState, config: GameConfig, node: WorldTreeNodeDef): number {
  const region = config.regions.find((r) => r.id === node.regionId)
  if (!region) return Infinity
  return Math.ceil(regionUnlockThreshold(run, config, region) * node.costShare * (config.regionCurrencyRate ?? 1))
}

export function worldTreeNodeError(run: RunState, config: GameConfig, nodeId: string): string | undefined {
  const node = (config.worldTrees ?? []).find((n) => n.id === nodeId)
  if (!node) return "스킬이 없습니다."
  if (worldTreeOwned(run, nodeId)) return "이미 배웠습니다."
  const region = config.regions.find((r) => r.id === node.regionId)
  if (!region || !isRegionUnlocked(run, config, region.id)) return "아직 열리지 않은 지역입니다."
  const tree = worldTreeNodes(config, node.regionId)
  const prev = tree[tree.indexOf(node) - 1]
  if (prev && !worldTreeOwned(run, prev.id)) return `먼저 「${prev.name}」을(를) 배워야 합니다.`
  if (regionCurrencyBalance(run, node.regionId) < worldTreeNodeCost(run, config, node)) {
    return `${region.currency?.name ?? "지역 화폐"}이(가) 부족합니다.`
  }
  return undefined
}

/** Buy the node with its own world's currency (no other wallet covers it). */
export function buyWorldTreeNode(run: RunState, config: GameConfig, nodeId: string): { run: RunState; error?: string } {
  const error = worldTreeNodeError(run, config, nodeId)
  if (error) return { run, error }
  const node = (config.worldTrees ?? []).find((n) => n.id === nodeId)!
  const cost = worldTreeNodeCost(run, config, node)
  return {
    run: {
      ...run,
      regionCurrency: { ...run.regionCurrency, [node.regionId]: regionCurrencyBalance(run, node.regionId) - cost },
      worldTreeIds: [...(run.worldTreeIds ?? []), nodeId],
    },
  }
}

/* ---------- Core capsule gacha ---------- */

export type GachaRarity = "common" | "rare" | "epic" | "legendary"

export type GachaReward =
  | { rarity: "common"; kind: "core"; amount: number }
  | { rarity: "rare"; kind: "boost"; multiplier: number; seconds: number; amount: number }
  | { rarity: "epic"; kind: "currency"; regionId: string; amount: number }
  | { rarity: "epic"; kind: "core"; amount: number }
  | { rarity: "legendary"; kind: "star"; stars: number }

/** Pulls without a legendary before one is guaranteed. */
export const GACHA_PITY = 60
/** Each legendary star: permanent production ×1.08 (survives rebirth). */
export const GACHA_STAR_PRODUCTION = 1.08
export const GACHA_BOOST_MULTIPLIER = 2
export const GACHA_BOOST_SECONDS = 180
/** A ten-pull costs nine. */
export const GACHA_TEN_PULL_DISCOUNT = 0.9
const GACHA_RATES: Array<[GachaRarity, number]> = [
  ["legendary", 0.02],
  ["epic", 0.1],
  ["rare", 0.28],
  ["common", 0.6],
]

export function gachaStarMultiplier(meta: MetaState): number {
  return GACHA_STAR_PRODUCTION ** (meta.gachaStars ?? 0)
}

/** Value of a second of play: production plus a slice of a click, never 0 (fresh runs). */
function gachaUnit(run: RunState, meta: MetaState, config: GameConfig, now: number): number {
  return Math.max(productionSnapshot(run, meta, config, now).perSecond, derivedClick(run, meta, config).click * 0.3, config.baseClick)
}

/** One capsule costs ten minutes of current income, so it stays meaningful all game. */
export function gachaCost(run: RunState, meta: MetaState, config: GameConfig, now: number, count: 1 | 10 = 1): number {
  const one = Math.ceil(gachaUnit(run, meta, config, now) * 600)
  return count === 10 ? Math.ceil(one * 10 * GACHA_TEN_PULL_DISCOUNT) : one
}

function rollRarity(pity: number, rng: () => number): GachaRarity {
  if (pity + 1 >= GACHA_PITY) return "legendary"
  let r = rng()
  for (const [rarity, rate] of GACHA_RATES) {
    if (r < rate) return rarity
    r -= rate
  }
  return "common"
}

/**
 * Pull `count` capsules: pays CORE, rolls rarities (legendary guaranteed by the pity counter) and
 * applies every reward. Epic pays the currency of a random open world (half its next tree node).
 */
export function pullGacha(
  run: RunState,
  meta: MetaState,
  config: GameConfig,
  now: number,
  rng: () => number,
  count: 1 | 10 = 1,
): { run: RunState; meta: MetaState; rewards: GachaReward[]; error?: string } {
  const cost = gachaCost(run, meta, config, now, count)
  if (run.coreEnergy < cost) return { run, meta, rewards: [], error: "CORE가 부족합니다." }
  const unit = gachaUnit(run, meta, config, now)
  let next: RunState = { ...run, coreEnergy: run.coreEnergy - cost }
  let nextMeta: MetaState = { ...meta }
  let earned = 0
  const rewards: GachaReward[] = []
  for (let i = 0; i < count; i++) {
    const rarity = rollRarity(nextMeta.gachaPity ?? 0, rng)
    nextMeta = { ...nextMeta, gachaPulls: (nextMeta.gachaPulls ?? 0) + 1, gachaPity: rarity === "legendary" ? 0 : (nextMeta.gachaPity ?? 0) + 1 }
    if (rarity === "common") {
      const amount = unit * 480
      earned += amount
      rewards.push({ rarity, kind: "core", amount })
    } else if (rarity === "rare") {
      const amount = unit * 240
      earned += amount
      const current = next.eventBoosts.find((b) => b.id === "gacha")
      const from = Math.max(now, current?.expiresAt ?? now)
      next = {
        ...next,
        eventBoosts: [
          ...next.eventBoosts.filter((b) => b.id !== "gacha"),
          { id: "gacha", multiplier: GACHA_BOOST_MULTIPLIER, expiresAt: from + GACHA_BOOST_SECONDS * 1000 },
        ],
      }
      rewards.push({ rarity, kind: "boost", multiplier: GACHA_BOOST_MULTIPLIER, seconds: GACHA_BOOST_SECONDS, amount })
    } else if (rarity === "epic") {
      const open = config.regions.filter((r) => r.currency && !r.isHome && isRegionUnlocked(next, config, r.id))
      if (open.length) {
        const region = open[Math.floor(rng() * open.length) % open.length]
        const nextNode = worldTreeNodes(config, region.id).find((n) => !worldTreeOwned(next, n.id))
        const amount = Math.ceil(
          nextNode ? worldTreeNodeCost(next, config, nextNode) * 0.5 : regionUnlockThreshold(next, config, region) * (config.regionCurrencyRate ?? 1) * 0.2,
        )
        next = { ...next, regionCurrency: { ...next.regionCurrency, [region.id]: regionCurrencyBalance(next, region.id) + amount } }
        rewards.push({ rarity, kind: "currency", regionId: region.id, amount })
      } else {
        const amount = unit * 1800
        earned += amount
        rewards.push({ rarity, kind: "core", amount })
      }
    } else {
      nextMeta = { ...nextMeta, gachaStars: (nextMeta.gachaStars ?? 0) + 1 }
      rewards.push({ rarity, kind: "star", stars: nextMeta.gachaStars ?? 1 })
    }
  }
  next = { ...next, coreEnergy: next.coreEnergy + earned, lifetimeCoreEnergy: next.lifetimeCoreEnergy + earned }
  nextMeta = { ...nextMeta, totalCoreEnergy: nextMeta.totalCoreEnergy + earned }
  return { run: next, meta: nextMeta, rewards }
}
