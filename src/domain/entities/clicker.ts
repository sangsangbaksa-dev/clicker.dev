export type FeverPhase = "IDLE" | "IGNITION" | "FEVER" | "COOL_DOWN"

export type FeverSource = "GAUGE" | "POTION" | null

export type InstabilityLevel = "LOW" | "MID" | "HIGH" | "CRISIS"

export type UpgradeCategory = "CLICK" | "PRODUCTION" | "FEVER" | "UTILITY"

export type SkillBranch = "FOCUS" | "AUTOMATION" | "RESONANCE" | "TRANSCENDENCE"

export type CrisisChoice = "STABILIZE" | "RISK_IT" | "EMERGENCY_OVERCLOCK"

export type ComboState = {
  count: number
  multiplier: number
  expiresAt: number
  maxCombo: number
}

export type FeverState = {
  phase: FeverPhase
  remainingTime: number
  duration: number
  gauge: number
  combo: number
  maxCombo: number
  critsThisFever: number
  finisherReady: boolean
  finisherUsed: boolean
  source: FeverSource
  potionId: string | null
}

export type TimedBuff = {
  id: string
  expiresAt: number
}

/** Golden-vein rewards: timed multipliers separate from skill buffs (which key into config). */
export type EventBoostId = "surge" | "laser_rush"

export type EventBoost = {
  id: EventBoostId
  multiplier: number
  expiresAt: number
}

export type RunState = {
  coreEnergy: number
  lifetimeCoreEnergy: number
  instability: number
  combo: ComboState
  fever: FeverState
  producerLevels: Record<string, number>
  ownedUpgradeIds: string[]
  ownedSkillNodeIds: string[]
  skillPoints: number
  skillPointsSpent: number
  potions: Record<string, number>
  skillItems: Record<string, number>
  skillCooldowns: Record<string, number>
  activeBuffs: TimedBuff[]
  crisisActive: boolean
  currentObjectiveId: string
  runStartedAt: number
  lastTickAt: number
  currentWorldLine: number
  currentRegionId: string
  clickCount: number
  feverStarts: number
  respecCount: number
  /** Absolute ms when the timed mine session ends; 0 when not in mine. */
  mineSessionEndsAt: number
  /** Absolute ms until Enter Mine is allowed again. */
  mineCooldownUntil: number
  /** CORE at session start — haul = coreEnergy - this while in mine. */
  mineSessionCoreAtEnter: number
  /** Session length in ms for the active run (base + skill bonuses). */
  mineSessionDurationMs: number
  /** Active golden-vein boosts (production surge / laser rush). */
  eventBoosts: EventBoost[]
  /** Absolute ms: auto-drill overdrive (×3 rate) runs until this. */
  drillOverdriveUntil: number
  /** Absolute ms: overdrive may be triggered again after this. */
  drillOverdriveReadyAt: number
}

export type ClickerStatistics = {
  clicks: number
  crits: number
  maxCombo: number
  feverStarts: number
  /** Golden veins claimed. */
  veins: number
  /** Center ores shattered in the mine. */
  oresBroken: number
  /** Monsters killed in hunt sessions. */
  monstersSlain: number
  /** Successful (non-miss) vault locks. */
  vaultLocks: number
  /** Timed mine sessions finished. */
  mineSessions: number
  /** Largest CORE gained in a single mine session. */
  bestMineHaul: number
}

export type MetaState = {
  totalCoreEnergy: number
  rebirthCount: number
  transcendenceIds: string[]
  statistics: ClickerStatistics
  /** Unlocked achievement ids — permanent across rebirths; each adds production. */
  achievementIds: string[]
  /** True when the player finished the true ending; run is frozen. */
  gameCompleted: boolean
  completedAt: number | null
}

export type ClickerSettings = {
  /** Sound effects off. */
  muted: boolean
  /** Background music off (independent of SFX). */
  musicMuted: boolean
  /** Background music volume, 0..1. */
  musicVolume: number
  /** Title screen cleared — lands on hub (upgrades/skills), not the mine. */
  gameStarted: boolean
  introSeen: boolean
  tutorialSeen: boolean
  /** Hub = upgrades/skills; mine = timed gathering scene. */
  playSurface: "hub" | "mine"
}

export type SaveData = {
  schemaVersion: number
  savedAt: number
  runState: RunState
  metaState: MetaState
  settings: ClickerSettings
}

export type ClickFx = "CLICK" | "CRITICAL" | "FEVER_CLICK"

export type ClickResult = {
  energyGained: number
  isCritical: boolean
  comboCount: number
  comboMultiplier: number
  feverBonus: number
  instabilityDelta: number
  fx: ClickFx
}

export type ProductionSnapshot = {
  perSecond: number
  byProducer: Record<string, number>
}

export type ProducerDef = {
  id: string
  name: string
  description: string
  unlockAt: number
  baseCost: number
  productionPerSecond: number
  costGrowth: number
  tags: string[]
  assetId: string
}

export type UpgradeDef = {
  id: string
  name: string
  description: string
  category: UpgradeCategory
  cost: number
  clickMultiplier?: number
  productionMultiplier?: number
  producerId?: string
  producerTag?: string
  criticalChanceAdd?: number
  criticalMultiplier?: number
  comboMaxAdd?: number
  feverDurationAdd?: number
  feverIntensity?: number
  finisherReward?: number
  unlockProducerId?: string
  unlockFeverStarts?: number
}

export type PotionDef = {
  id: string
  name: string
  description: string
  duration: number
  clickMultiplier: number
  productionMultiplier: number
  criticalChanceAdd: number
  instabilityPerSecond: number
  shopCost: number
  assetId: string
}

export type SkillNodeDef = {
  id: string
  branch: SkillBranch
  name: string
  description: string
  cost: number
  requires?: string[]
  clickMultiplier?: number
  productionMultiplier?: number
  criticalChanceAdd?: number
  comboWindowAdd?: number
  feverDurationAdd?: number
  feverIntensity?: number
  startingEnergy?: number
  /** Extra seconds added to the timed mine session (base is 10s). */
  mineSessionSecondsAdd?: number
  /** Auto-drill strikes per second on the center ore while in the mine. */
  autoDrillPerSecond?: number
}

export type AchievementKind =
  | "CLICKS"
  | "CRITS"
  | "COMBO"
  | "FEVERS"
  | "LIFETIME"
  | "PRODUCERS"
  | "SKILLS"
  | "REBIRTHS"
  | "VEINS"
  | "ORES"
  | "MINE_SESSIONS"
  | "MINE_HAUL"

export type AchievementDef = {
  id: string
  name: string
  description: string
  kind: AchievementKind
  target: number
}

export type ActiveSkillDef = {
  id: string
  name: string
  description: string
  cooldown: number
  duration: number
  shopCost: number
  productionMultiplier?: number
  clickMultiplier?: number
  energyBurstSeconds?: number
  instabilityPerSecond?: number
  instabilityDelta?: number
  assetId: string
}

/** How a region's timed session earns CORE: ore mining, monster hunting, or vault cracking. */
export type RegionActivity = "mine" | "hunt" | "vault"

export type RegionDef = {
  id: string
  name: string
  description: string
  bgAssetId: string
  unlockAtLifetimeEnergy: number
  isHome?: boolean
  /** Session activity; defaults to "mine". */
  activity?: RegionActivity
  /** Applied only while `run.currentRegionId` matches this region. */
  clickMultiplier?: number
  /** Applied only while `run.currentRegionId` matches this region. */
  productionMultiplier?: number
}

export type ObjectiveDef = {
  id: string
  title: string
  lumaLine: string
  kind: "ENERGY" | "PRODUCER" | "FEVER" | "REBIRTH" | "SKILL" | "POTION"
  target: number
  producerId?: string
  nextId: string | null
}

export type TranscendenceDef = {
  id: string
  name: string
  description: string
  identity: string
  clickMultiplier?: number
  productionMultiplier?: number
  feverDurationAdd?: number
  instabilityRewardBonus?: number
  startingEnergy?: number
  comboWindowAdd?: number
  assetId: string
}

export type GameConfig = {
  schemaVersion: number
  baseClick: number
  baseCritChance: number
  baseCritMultiplier: number
  critChanceSoftCap: number
  comboWindow: number
  comboPerStack: number
  comboMultiplierCap: number
  feverGaugeMax: number
  feverDuration: number
  feverClickMultiplier: number
  feverProductionMultiplier: number
  feverCritChanceAdd: number
  feverComboCap: number
  feverCoolDown: number
  offlineCapSeconds: number
  /** Offline auto production as a fraction of online per-second rate (e.g. 0.05 = 1/20). */
  offlineProductionRatio: number
  rebirthEnergy: number
  skillPointEveryLevels: number
  producers: ProducerDef[]
  upgrades: UpgradeDef[]
  potions: PotionDef[]
  skillNodes: SkillNodeDef[]
  activeSkills: ActiveSkillDef[]
  objectives: ObjectiveDef[]
  regions: RegionDef[]
  transcendence: TranscendenceDef[]
  achievements: AchievementDef[]
  synergies: Array<{
    producerId: string
    minLevel: number
    clickBonus?: number
    productionTargetId?: string
    productionBonus?: number
    feverDurationBonus?: number
    instabilityRewardBonus?: number
  }>
}
