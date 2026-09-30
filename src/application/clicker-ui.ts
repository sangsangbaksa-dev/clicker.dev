/**
 * Clicker UI facade: types and read-only helpers for components and hooks.
 * Domain rules stay in domain; this module is the outward-facing import surface.
 */
export { spawnMineOres } from "@/application/spawn-mine-ores"
export { ORE_ART } from "@/infrastructure/ore-art"
export { oreHitBox, oreStrikePoint, type OreNode } from "@/domain/services/ore-node"
export { formatNumber } from "@/domain/services/clicker-format"
export {
  bulkAffordable,
  bulkCostText,
  buildActiveSkillShopViews,
  buildHud,
  buildPotionShopViews,
  buildProducerViews,
  buildRegionViews,
  buildSkillNodeViews,
  buildUpgradeViews,
  type CoreVisual,
  type CurrencyCostView,
  type SkillNodeView,
} from "@/domain/services/clicker-view"
export type {
  BossDef,
  BossFight,
  ClickerSettings,
  CrisisChoice,
  MetaState,
  RegionChallengeKind,
  RegionIntroDef,
  RunState,
  SaveData,
  TranscendenceDef,
  UpgradeCategory,
} from "@/domain/entities/clicker"
export type { ParsedSaveCode } from "@/domain/services/clicker-save-transfer"
export type { MineSessionStart, MineSessionSummary } from "@/domain/services/clicker-mine-session"
export type { GearSlot, GearTier } from "@/domain/services/clicker-lair"
export {
  INSTABILITY_WARNING,
  drillCooldownMs,
  isRegionUnlocked,
  monsterAlive,
  productionSnapshot,
  regionCurrencyBalance,
  scaledCost,
} from "@/domain/services/clicker-engine"
export {
  CLICKER_ADMIN_REMEMBER_KEY,
  CLICKER_PRELAUNCH,
  isClickerAdminAllowed,
} from "@/domain/services/clicker-admin-gate"
export { isConfirmReady } from "@/domain/services/clicker-confirm-guard"
export { achievementProgress, autoDrillRate, baseDrillRate, VEIN_LIFETIME_MS, VEIN_SPAWN_CHANCE } from "@/domain/services/clicker-bonus"
export {
  buildScreenTabs,
  manageTabForScreen,
  shouldMountMineChamber,
  shouldShowManageScreen,
  type ClickerScreenTabId,
  type ManageDrawerTabId,
  type ScreenTabDef,
} from "@/domain/services/clicker-screen-tabs"
export {
  formatMinePauseBadge,
  isLiveMineSession,
  isMinePaused,
} from "@/domain/services/clicker-mine-pause"
export {
  AMULETS,
  ARMORS,
  GEAR,
  GEAR_SLOTS,
  HELMETS,
  LAIR_BOSSES,
  WEAPONS,
  forgeError,
  gearImage,
  gearOf,
  lairAttackEveryMs,
  playerMaxHp,
  shieldRemainingMs,
} from "@/domain/services/clicker-lair"
