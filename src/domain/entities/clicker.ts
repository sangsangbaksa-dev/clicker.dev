export type FeverPhase = "IDLE" | "IGNITION" | "FEVER" | "COOL_DOWN"

export type FeverSource = "GAUGE" | "POTION" | null

export type InstabilityLevel = "LOW" | "MID" | "HIGH" | "CRISIS"

export type UpgradeCategory = "CLICK" | "PRODUCTION" | "FEVER" | "UTILITY"

export type SkillBranch = "FOCUS" | "AUTOMATION" | "RESONANCE" | "TRANSCENDENCE" | "HUNT"

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
/** Golden-vein and region-activity rewards. */
export type EventBoostId = "surge" | "laser_rush" | "relay"

export type EventBoost = {
  id: EventBoostId
  multiplier: number
  expiresAt: number
}

export type LairFight = {
  regionId: string
  bossHp: number
  bossMaxHp: number
  playerHp: number
  playerMaxHp: number
  nextAttackAt: number
  /** Strikes landed this fight (drives the lair-only shockwave and stun). */
  strikes?: number
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
  /** Per-region currency balances (region id → amount); resets with the run. */
  regionCurrency?: Record<string, number>
  /** World skill-tree nodes bought this run (each world's tree is paid in its own currency). */
  worldTreeIds?: string[]
  /** Last automatic core collapse (instability hit 100): when, and how much CORE it took. */
  lastCollapse?: { at: number; loss: number }
  /** Forged gear tiers (index into WEAPONS / ARMORS / HELMETS / AMULETS). */
  gear?: { weapon: number; armor: number; helmet?: number; amulet?: number }
  /** Failed forge attempts since the last success, per slot (drives the pity odds). */
  forgeFails?: Partial<Record<"weapon" | "armor" | "helmet" | "amulet", number>>
  /** Active lair battle against the current region's boss. */
  lair?: LairFight | null
  /** After beating the player, a boss is shielded until this time (region id → ms). */
  monsterShieldUntil?: Record<string, number>
  clickCount: number
  feverStarts: number
  respecCount: number
  /** Absolute ms when the timed mine session ends; 0 when not in mine. */
  mineSessionEndsAt: number
  /** Frozen remaining ms while the mine session is paused off the Mine tab; 0 when none. */
  minePausedRemainMs: number
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
  /** Region id → absolute ms when its activity can be used again. */
  regionCooldowns: Record<string, number>
  /** Region id → absolute ms when its field challenge can be played again. */
  challengeCooldowns: Record<string, number>
  /** Phase Vault deposit waiting to pay out (0 when empty). */
  vaultDeposit: number
  vaultReadyAt: number
  /** Storm Spire: every click is a lightning strike until this. */
  lightningStormUntil: number
  /** Drone Foundry: drone strikes are multiplied until this. */
  droneSwarmUntil: number
  /** Worldline price level: every CORE cost and goal in this run is multiplied by it. */
  costScale: number
  /** Region id → absolute ms when its monster respawns (absent/past = alive). */
  monsterRespawnAt: Record<string, number>
  /** Region core drilling: taps fill the gauge (0–1); a full gauge pays out and starts the cooldown. */
  drillGauge: number
  drillCooldownUntil: number
  /** Active boss fight, or null. */
  boss: BossFight | null
}

export type BossFight = {
  regionId: string
  hp: number
  maxHp: number
  playerHp: number
  playerMaxHp: number
  endsAt: number
  nextAttackAt: number
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
  /** Regions entered at least once — their intro cinematic plays only on the first visit. */
  visitedRegionIds: string[]
  /** First title-screen start time for this save; null for legacy saves without a known start. */
  startedAt: number | null
  /** True when the player finished the true ending; run is frozen. */
  gameCompleted: boolean
  completedAt: number | null
  /** The core guardian fell at least once — unlocks the ending. */
  bossDefeated: boolean
  monstersSlain: number
  /** Relic Vault: relic id → level. Permanent across rebirths. */
  relicLevels: Record<string, number>
  /** Legacy production stars from retired capsule shop saves; no new grants. */
  gachaStars?: number
  /** 세계선 교환소 weekly purchase counts. */
  exchange?: ExchangeState
}

export type ExchangeState = {
  weekStart: number
  bought: Record<string, number>
}

export type ExchangeReward =
  | { kind: "POTION"; potionId: string }
  | { kind: "CORE_CAPSULE"; coreAmount: number }

export type ExchangeOfferDef = {
  id: string
  name: string
  description: string
  regionId: string
  cost: number
  weeklyLimit: number
  reward: ExchangeReward
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
  lightning: boolean
  quake: boolean
  echo: boolean
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
  /** Late producers exist only from this worldline on (1 = the first). */
  requiresWorldLine?: number
}

export type UpgradeDef = {
  /** Icon; each upgrade has its own art. */
  assetId?: string
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
  /** Region drill: seconds cut from the cooldown between bores. */
  drillCooldownReduceSec?: number
  /** Region drill: fewer taps needed to fill the gauge. */
  drillTapsReduce?: number
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
  /** Icon; each circuit has its own art. */
  assetId?: string
  branch: SkillBranch
  /** Depth band 1–5; 5 is the branch capstone. */
  tier: number
  name: string
  description: string
  cost: number
  requires?: string[]
  clickMultiplier?: number
  /** Global production, or only producers carrying `producerTag` when set. */
  productionMultiplier?: number
  producerTag?: string
  criticalChanceAdd?: number
  criticalMultiplier?: number
  comboMaxAdd?: number
  finisherReward?: number
  flatProductionBonus?: number
  comboWindowAdd?: number
  /** Owning this circuit unlocks FEVER (gauge, gauge start and potions); locked until then. */
  unlocksFever?: boolean
  feverDurationAdd?: number
  feverIntensity?: number
  /** CORE carried into the next run when rebirthing with this node owned. */
  startingEnergy?: number
  /** Extra seconds added to the timed mine session (base is 10s). */
  mineSessionSecondsAdd?: number
  /** Auto-drill strikes per second on the center ore while in the mine. */
  autoDrillPerSecond?: number
  /** Lightning strike: chance per click to add click energy × lightning multiplier. */
  lightningChanceAdd?: number
  lightningMultiplierAdd?: number
  /** Each chain adds another half-strength lightning hit. */
  lightningChainAdd?: number
  /** Shockwave: every Nth click adds click energy × quake multiplier. */
  quakeMultiplierAdd?: number
  quakeIntervalReduce?: number
  /** Echo strike: chance per click to land the same hit twice. */
  echoChanceAdd?: number
  /** Mining drones: automatic strikes per second at a fraction of click power, everywhere. */
  droneStrikesPerSecond?: number
  droneEfficiencyAdd?: number
  /** Region monsters drop this much more CORE (multiplies). */
  monsterRewardMultiplier?: number
  /** Seconds shaved off the mine re-entry and core-drilling cooldowns. */
  cooldownReduceSec?: number
  /** Seconds shaved off a region monster's respawn. */
  monsterRespawnReduce?: number
  /** Damage against the Core guardian (multiplies). */
  bossDamageMultiplier?: number
  /** Strike damage against lair creatures (multiplies the forged weapon). */
  lairDamageMultiplier?: number
  /** Lair-only shockwave: every Nth strike on a creature adds weapon damage × this. */
  lairQuakeMultiplierAdd?: number
  lairQuakeIntervalReduce?: number
  /** Lair-only weak spot: chance per strike to hit a creature for extra damage. */
  lairCritChanceAdd?: number
  /** Added to the weak-spot multiplier (base ×3). */
  lairCritMultiplierAdd?: number
  /** Fraction of max HP healed on every strike in a lair. */
  lairLifesteal?: number
  /** Every LAIR_STUN_EVERY strikes the creature's next swing comes this many ms later. */
  lairStunMs?: number
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
  /** Instant CORE worth this many strikes at the current strike power. */
  clickBurst?: number
  instabilityPerSecond?: number
  instabilityDelta?: number
  /** While the buff runs, added straight onto the crit chance (past the usual cap, up to 100%). */
  criticalChanceAdd?: number
  /** Calls a lightning storm for `duration`: every strike arcs lightning. */
  lightningStorm?: boolean
  /** Starts FEVER at once (FEVER must be unlocked). */
  feverIgnite?: boolean
  /** Clears the cooldown of every other active skill. */
  cooldownReset?: boolean
  assetId: string
}

export type RegionActivityKind =
  | "PRODUCTION_BOOST"
  | "PHASE_DEPOSIT"
  | "LIGHTNING_STORM"
  | "PRODUCTION_BURST"
  | "DRONE_SWARM"

/** One active ability per region, usable only while standing in that region. */
export type RegionActivityDef = {
  kind: RegionActivityKind
  name: string
  description: string
  cooldownSec: number
  /** Boost / payout / drone multiplier. */
  multiplier?: number
  durationSec?: number
  /** PHASE_DEPOSIT: share of banked CORE locked away. */
  depositShare?: number
  /** PRODUCTION_BURST: seconds of production paid at once. */
  productionSeconds?: number
}

export type RegionDef = {
  id: string
  name: string
  /** Local currency earned alongside CORE while standing here; late upgrades cost it. */
  currency?: { name: string; icon: string }
  description: string
  bgAssetId: string
  unlockAtLifetimeEnergy: number
  isHome?: boolean
  /** Applied only while `run.currentRegionId` matches this region. */
  clickMultiplier?: number
  /** Applied only while `run.currentRegionId` matches this region. */
  productionMultiplier?: number
  /** Presence bonuses for the strike mining methods. */
  lightningChanceAdd?: number
  quakeIntervalReduce?: number
  droneEfficiencyAdd?: number
  activity?: RegionActivityDef
  /** Hands-on mini-game played in the region; pays CORE by score. */
  challenge?: RegionChallengeDef
  /** First-visit cinematic (video with its own soundtrack), played once per save. */
  intro?: RegionIntroDef
  /** Rebirths needed before the region can open (on top of lifetime CORE). */
  requiresRebirths?: number
  /** The creature roaming this region's background. */
  monster?: MonsterDef
  /** Hunting ground: the region's main action is killing its background creatures. */
  huntMode?: boolean
  /** Final guardian fight (last region only). */
  boss?: BossDef
}

export type MonsterDef = {
  name: string
  /** Visual kind drawn by the client. */
  kind: string
  /** Kill pays this many seconds of current production (plus a click-based floor). */
  rewardSeconds: number
  respawnSec: number
}

export type BossDef = {
  name: string
  kind: string
  /** Optional painted art (transparent PNG/WebP); replaces the inline SVG creature. */
  imageSrc?: string
  /** Guardian health in CORE-strike damage. */
  hp: number
  playerHp: number
  /** Damage dealt to the player per attack. */
  attackDamage: number
  attackEverySec: number
  timeLimitSec: number
}

export type RegionChallengeKind = "ROD_STRIKE" | "FAULT_DRILL" | "DRONE_RECALL" | "SIGNAL_TUNE" | "VAULT_LOCK"

/** Timed field mini-game: a perfect run pays `rewardSeconds` of current production. */
export type RegionChallengeDef = {
  kind: RegionChallengeKind
  name: string
  description: string
  durationSec: number
  rewardSeconds: number
  cooldownSec: number
}

export type RegionIntroDef = {
  video: string
  /** Still shown before the first frame and on load failure. */
  poster: string
  /** A frame from the video: the world's landing view until the player picks an action. */
  still: string
  /** Short clip played when the player leaves the still for the action (hunt or drill). */
  engageVideo?: string
}

export type ObjectiveDef = {
  id: string
  title: string
  line: string
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
  flatProductionBonus?: number
  startingEnergy?: number
  comboWindowAdd?: number
  criticalMultiplier?: number
  feverIntensity?: number
  lightningChanceAdd?: number
  echoChanceAdd?: number
  droneStrikesPerSecond?: number
  assetId: string
}

/**
 * One node of a world's skill tree. Bought in order with that world's currency only, and every
 * effect applies to that world only (its currency mint, its presence bonus, its activity,
 * field challenge and monster). Run-scoped like the currency itself.
 */
export type WorldTreeNodeDef = {
  id: string
  regionId: string
  name: string
  description: string
  /** Price as a share of the world's unlock threshold in this worldline, times the base mint rate. */
  costShare: number
  /** Multiplies the world's currency mint rate. */
  currencyMultiplier?: number
  /** Multiplies click and production while standing in the world. */
  presenceMultiplier?: number
  /** Strengthens the world's activity (boost size, deposit payout, storm length, burst size). */
  activityMultiplier?: number
  /** Multiplies the world's field-challenge reward. */
  challengeMultiplier?: number
  /** Multiplies the world's monster reward. */
  monsterMultiplier?: number
}

/**
 * Relic Vault item: a permanent upgrade bought level by level with one world's currency. Each
 * level adds `perLevel` once more (multipliers compound, additions stack) through the same
 * pipeline as walked worldlines.
 */
export type RelicDef = {
  id: string
  name: string
  lore: string
  /** World whose currency pays for it (newer worlds' wallets cover a shortfall). */
  regionId: string
  maxLevel: number
  perLevel: Omit<TranscendenceDef, "id" | "name" | "description" | "identity" | "assetId" | "startingEnergy">
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
  /** Lifetime CORE needed for the first rebirth. */
  rebirthEnergy: number
  /** Each rebirth multiplies the next requirement by this. */
  rebirthGrowth: number
  /**
   * Per-worldline correction on that requirement (index = rebirths so far; missing = 1), so each
   * worldline can be paced to its own length.
   */
  rebirthGoalScale?: number[]
  /**
   * Extra factor on the rebirth requirement only (index = rebirths so far; missing = 1). Worlds
   * open at a share of the scaled goal above, so this lengthens a worldline after its last world
   * has opened without pushing the worlds themselves later.
   */
  rebirthGoalStretch?: number[]
  /** Each rebirth multiplies every CORE price (producers, upgrades, circuits, shop) by this. */
  priceGrowth: number
  /**
   * Soft cap on the bought multiplier stack (upgrades + skill circuits): above this, further
   * multipliers count only as (excess)^stackSoftExponent. Unset = no cap.
   */
  stackSoftCap?: number
  stackSoftExponent?: number
  /** Permanent click & production multiplier gained per rebirth (compounding). */
  worldlineBonus: number
  skillPointEveryLevels: number
  producers: ProducerDef[]
  upgrades: UpgradeDef[]
  potions: PotionDef[]
  skillNodes: SkillNodeDef[]
  activeSkills: ActiveSkillDef[]
  objectives: ObjectiveDef[]
  regions: RegionDef[]
  transcendence: TranscendenceDef[]
  relics: RelicDef[]
  /** Per-world skill trees, in purchase order within each world. */
  worldTrees?: WorldTreeNodeDef[]
  /** Share of the CORE earned in a world that mints its currency before any tree bonus. */
  regionCurrencyRate?: number
  achievements: AchievementDef[]
  synergies: Array<{
    producerId: string
    minLevel: number
    clickBonus?: number
    productionTargetId?: string
    productionBonus?: number
    feverDurationBonus?: number
    flatProductionBonus?: number
  }>
}
