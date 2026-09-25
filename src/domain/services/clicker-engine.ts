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
  SkillNodeDef,
  TimedBuff,
  TranscendenceDef,
  UpgradeDef,
} from "../entities/clicker"
import {
  achievementProductionMultiplier,
  eventBoostMultiplier,
  pruneEventBoosts,
} from "./clicker-bonus.ts"

/** Base timed-mine length before skill-tree extensions. Balance PROVISIONAL. */
export const MINE_SESSION_BASE_MS = 10_000
export const MINE_REENTER_COOLDOWN_MS = 30_000
export const MINE_REENTER_CORE_COST = 25

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
    currentWorldLine: meta.rebirthCount + 1,
    currentRegionId: config.regions.find((r) => r.isHome)?.id ?? config.regions[0]?.id ?? "core_chamber",
    clickCount: 0,
    feverStarts: 0,
    respecCount: 0,
    mineSessionEndsAt: 0,
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
  }
}

export function isGameCompleted(meta: MetaState): boolean {
  return Boolean(meta.gameCompleted)
}

export function canTriggerTrueEnding(meta: MetaState, config: GameConfig): boolean {
  if (meta.gameCompleted) return false
  const owned = new Set(meta.transcendenceIds)
  return config.transcendence.every((t) => owned.has(t.id))
}

export function applyTrueEnding(save: SaveData, config: GameConfig, now: number): { save: SaveData; error?: string } {
  if (save.metaState.gameCompleted) return { save, error: "이미 완료된 기록입니다." }
  if (!canTriggerTrueEnding(save.metaState, config)) {
    return { save, error: "아직 Protocol 조건이 충족되지 않았습니다." }
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
      tutorialSeen: true,
      playSurface: "hub",
    },
  }
}

/** Timed mine length: 10s base + owned skill `mineSessionSecondsAdd` totals. */
export function mineSessionDurationMs(run: RunState, config: GameConfig): number {
  const addSec = ownedSkills(run, config).reduce((sum, n) => sum + (n.mineSessionSecondsAdd ?? 0), 0)
  return MINE_SESSION_BASE_MS + Math.max(0, addSec) * 1000
}

/**
 * Whether Enter Mine is allowed right now, and what it costs.
 * Re-enter rules: cooldown `MINE_REENTER_COOLDOWN_MS`; CORE cost `MINE_REENTER_CORE_COST`
 * when cooldown was set (subsequent enters). The cost is waived when the player can't
 * pay and owns no producers — mining is then the only CORE source, so charging would soft-lock.
 */
export function mineEntryCheck(save: SaveData, now: number): { cost: number; error?: string } {
  if (save.runState.mineCooldownUntil > now) {
    const secs = Math.ceil((save.runState.mineCooldownUntil - now) / 1000)
    return { cost: 0, error: `광산 재입장 대기 ${secs}초` }
  }
  const hadCooldown = save.runState.mineCooldownUntil > 0
  const cost = hadCooldown ? scaledCost(save.runState, MINE_REENTER_CORE_COST) : 0
  if (cost > 0 && save.runState.coreEnergy < cost) {
    const hasProducers = Object.values(save.runState.producerLevels ?? {}).some((level) => level > 0)
    if (!hasProducers) return { cost: 0 }
    return { cost, error: `재입장에 CORE ${cost}이 필요합니다.` }
  }
  return { cost }
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
      runState: {
        ...save.runState,
        coreEnergy: coreAfterCost,
        mineSessionEndsAt: now + durationMs,
        mineSessionCoreAtEnter: coreAfterCost,
        mineSessionDurationMs: durationMs,
      },
    },
  }
}

/** Leave mine → hub; starts re-enter cooldown. */
export function exitClickerMine(save: SaveData, now: number): SaveData {
  if (save.settings.playSurface !== "mine" && save.runState.mineSessionEndsAt <= 0) {
    return {
      ...save,
      settings: { ...save.settings, playSurface: "hub" },
    }
  }
  return {
    ...save,
    settings: { ...save.settings, playSurface: "hub" },
    runState: {
      ...save.runState,
      mineSessionEndsAt: 0,
      mineCooldownUntil: now + MINE_REENTER_COOLDOWN_MS,
      mineSessionCoreAtEnter: 0,
      mineSessionDurationMs: 0,
    },
  }
}

/** Tick helper: auto-exit when the timed session expires. */
export function syncClickerMineSession(save: SaveData, now: number): SaveData {
  if (save.settings.playSurface !== "mine") return save
  if (save.runState.mineSessionEndsAt <= 0 || save.runState.mineSessionEndsAt <= now) {
    return exitClickerMine(save, now)
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

function ownedTranscendence(meta: MetaState, config: GameConfig): TranscendenceDef[] {
  const set = new Set(meta.transcendenceIds)
  return config.transcendence.filter((t) => set.has(t.id))
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
  return config.rebirthEnergy * config.rebirthGrowth ** meta.rebirthCount
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
  return {
    click: region?.clickMultiplier ?? 1,
    production: region?.productionMultiplier ?? 1,
  }
}

export function derivedClick(run: RunState, meta: MetaState, config: GameConfig) {
  const upgrades = ownedUpgrades(run, config)
  const skills = ownedSkills(run, config)
  const trans = ownedTranscendence(meta, config)
  const region = regionPresenceMultipliers(run, config)
  let click = config.baseClick
  click *= product(upgrades.map((u) => u.clickMultiplier ?? 1))
  click *= product(skills.map((s) => s.clickMultiplier ?? 1))
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
  if (feverActive(run.fever)) {
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
  if (!feverActive(run.fever)) {
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
  return run.lifetimeCoreEnergy >= scaledCost(run, producer.unlockAt) || (run.producerLevels[producerId] ?? 0) > 0
}

function buffMultiplier(run: RunState, now: number, skillId: string, field: "productionMultiplier" | "clickMultiplier", config: GameConfig): number {
  const active = run.activeBuffs.find((b) => b.id === skillId && b.expiresAt > now)
  if (!active) return 1
  const skill = config.activeSkills.find((s) => s.id === skillId)
  return skill?.[field] ?? 1
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
  const overclock = buffMultiplier(run, now, "overclock", "productionMultiplier", config)
  const stabilizer = buffMultiplier(run, now, "stabilizer", "productionMultiplier", config)
  const region = regionPresenceMultipliers(run, config)
  const globalProd =
    product(upgrades.filter((u) => !u.producerId && !u.producerTag).map((u) => u.productionMultiplier ?? 1)) *
    product(skills.filter((s) => !s.producerTag).map((s) => s.productionMultiplier ?? 1)) *
    product(trans.map((t) => t.productionMultiplier ?? 1)) *
    fever.production *
    instab *
    overclock *
    stabilizer *
    region.production *
    eventBoostMultiplier(run, "surge", now) *
    eventBoostMultiplier(run, "relay", now) *
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
    let rate = producer.productionPerSecond * level
    for (const u of upgrades) {
      if (u.productionMultiplier && u.producerId === producer.id) rate *= u.productionMultiplier
      if (u.productionMultiplier && u.producerTag && producer.tags.includes(u.producerTag)) {
        rate *= u.productionMultiplier
      }
    }
    for (const s of skills) {
      if (s.productionMultiplier && s.producerTag && producer.tags.includes(s.producerTag)) {
        rate *= s.productionMultiplier
      }
    }
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

  const fever = feverMultipliers(run, meta, config)
  const isCritical = rng() < derived.critChance
  if (isCritical) combo.expiresAt += 250

  let hit = derived.click * combo.multiplier * fever.click * eventBoostMultiplier(run, "laser_rush", now)
  if (isCritical) hit *= derived.critMult

  const strikes = strikeStats(run, config, meta, now)
  let energy = hit
  const echo = strikes.echoChance > 0 && rng() < strikes.echoChance
  if (echo) energy += hit
  const lightning = strikes.lightningChance > 0 && rng() < strikes.lightningChance
  if (lightning) energy += hit * strikes.lightningMultiplier * (1 + 0.5 * strikes.lightningChains)
  const quake = strikes.quakeMultiplier > 0 && (run.clickCount + 1) % strikes.quakeInterval === 0
  if (quake) energy += hit * strikes.quakeMultiplier

  const feverState = { ...run.fever }
  if (feverActive(feverState)) {
    feverState.combo = Math.min(feverState.combo + 1, config.feverComboCap)
    if (isCritical) feverState.critsThisFever += 1
    feverState.finisherReady =
      !feverState.finisherUsed &&
      (feverState.combo >= config.feverComboCap || feverState.critsThisFever >= 5)
    combo.expiresAt += 400
  } else if (feverState.phase === "IDLE") {
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
      fx: isCritical ? "CRITICAL" : feverActive(feverState) ? "FEVER_CLICK" : "CLICK",
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
  return {
    run: {
      ...run,
      coreEnergy: run.coreEnergy - cost,
      potions: { ...run.potions, [potionId]: (run.potions[potionId] ?? 0) + 1 },
    },
  }
}

export function buyActiveSkillItem(
  run: RunState,
  config: GameConfig,
  skillId: string
): { run: RunState; error?: string } {
  const skill = config.activeSkills.find((s) => s.id === skillId)
  if (!skill) return { run, error: "스킬을 찾을 수 없습니다." }
  const cost = scaledCost(run, skill.shopCost)
  if (run.coreEnergy < cost) return { run, error: "CORE가 부족합니다." }
  return {
    run: {
      ...run,
      coreEnergy: run.coreEnergy - cost,
      skillItems: { ...run.skillItems, [skillId]: (run.skillItems[skillId] ?? 0) + 1 },
    },
  }
}

export function startFever(
  run: RunState,
  meta: MetaState,
  config: GameConfig,
  source: "GAUGE" | "POTION",
  potionId: string | null
): { run: RunState; error?: string } {
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
  const burst = snapshot.perSecond * 3 * rewardMult + run.coreEnergy * 0.02
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
  next.activeBuffs = next.activeBuffs.filter((b) => b.expiresAt > now)
  const cooldowns: Record<string, number> = {}
  for (const [id, remaining] of Object.entries(next.skillCooldowns)) {
    const left = remaining - dt
    if (left > 0) cooldowns[id] = left
  }
  next.skillCooldowns = cooldowns

  if (next.fever.phase === "FEVER" || next.fever.phase === "IGNITION") {
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
    const payout = next.vaultDeposit * vaultMultiplier(config)
    // The deposit left the bank but was already counted as earned; only the interest is new.
    gained += payout - next.vaultDeposit
    next = { ...next, coreEnergy: next.coreEnergy + next.vaultDeposit, vaultDeposit: 0, vaultReadyAt: 0 }
  }
  next = {
    ...next,
    coreEnergy: next.coreEnergy + gained,
    lifetimeCoreEnergy: next.lifetimeCoreEnergy + gained,
  }
  if (next.instability >= 100 && !next.crisisActive) next.crisisActive = true
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
  return {
    run: {
      ...run,
      coreEnergy: run.coreEnergy - cost,
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
  return {
    run: {
      ...run,
      coreEnergy: run.coreEnergy - cost,
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

export function canRebirth(run: RunState, meta: MetaState, config: GameConfig): boolean {
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
        { id: "relay", multiplier: activity.multiplier ?? 1, expiresAt: until },
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
      next.lightningStormUntil = until
      break
    case "DRONE_SWARM":
      next.droneSwarmUntil = until
      break
    case "PRODUCTION_BURST": {
      const perSecond = productionSnapshot(next, meta, config, now).perSecond
      const burst = perSecond * (activity.productionSeconds ?? 0)
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
  const reward = productionSnapshot(run, meta, config, now).perSecond * challenge.rewardSeconds * ratio
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

export function isRegionUnlocked(run: RunState, config: GameConfig, regionId: string): boolean {
  const region = config.regions.find((r) => r.id === regionId)
  if (!region) return false
  return run.lifetimeCoreEnergy >= scaledCost(run, region.unlockAtLifetimeEnergy)
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
  return { run: { ...run, currentRegionId: regionId } }
}

/** Records a region visit; `firstVisit` is true only the first time the region is entered. */
export function markRegionVisited(meta: MetaState, regionId: string): { meta: MetaState; firstVisit: boolean } {
  if (meta.visitedRegionIds.includes(regionId)) return { meta, firstVisit: false }
  return { meta: { ...meta, visitedRegionIds: [...meta.visitedRegionIds, regionId] }, firstVisit: true }
}

export function returnHomeRegion(run: RunState, config: GameConfig): { run: RunState; error?: string } {
  const homeId = homeRegionId(config)
  if (run.currentRegionId === homeId) return { run, error: "이미 Core Mine에 있습니다." }
  return { run: { ...run, currentRegionId: homeId } }
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
        costScale:
          typeof run.costScale === "number" && run.costScale > 0
            ? run.costScale
            : worldlineCostScale({ ...createInitialMeta(), ...meta }, config),
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


export type { ActiveSkillDef }
