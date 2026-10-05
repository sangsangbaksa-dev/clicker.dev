/**
 * Clicker UI facade: types and read-only helpers for components and hooks.
 * Domain rules stay in domain; this module is the outward-facing import surface.
 */
export { spawnMineOres } from "@/application/spawn-mine-ores"
export { ORE_ART } from "@/infrastructure/ore-art"
export { loadAlphaMask } from "@/infrastructure/image/alpha-mask-loader"
export { oreHitBox, oreStrikePoint, type OreNode } from "@/domain/services/ore-node"
export { formatNumber, formatRate } from "@/domain/services/clicker-format"
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
  skillStatusLabel,
  type CoreVisual,
  type CurrencyCostView,
  type SkillNodeView,
} from "@/domain/services/clicker-view"
export type {
  GachaLogEntry,
  BossDef,
  BossFight,
  ClickerSettings,
  CrisisChoice,
  MetaState,
  RegionChallengeKind,
  RegionIntroDef,
  RelicDef,
  RunState,
  WorldTreeNodeDef,
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
  relicVaultOpen,
  relicCost,
  relicEffectAt,
  relicError,
  relicLevel,
  productionSnapshot,
  regionCurrencyBalance,
  regionCurrencyRate,
  scaledCost,
  worldTreeNodes,
  worldTreeOwned,
  worldTreeNodeCost,
  worldTreeNodeError,
  gachaCost,
  lairDamageMultiplier,
  gachaFreeReady,
  gachaLegendaryRate,
  gachaStarMultiplier,
  GACHA_PITY,
  GACHA_SOFT_PITY,
  GACHA_FREE_EVERY_MS,
  GACHA_STAR_PRODUCTION,
  type GachaReward,
  type GachaRarity,
} from "@/domain/services/clicker-engine"
export {
  CLICKER_ADMIN_REMEMBER_KEY,
  CLICKER_PRELAUNCH,
  grantClickerAdminByCode,
  isClickerAdminAllowed,
} from "@/domain/services/clicker-admin-gate"
export { isConfirmReady } from "@/domain/services/clicker-confirm-guard"
export {
  activeSkillBarHint,
  activeSkillBarShortLabel,
  activeSkillBarStatusLine,
  isActiveSkillBarDisabled,
  resolveActiveSkillBarState,
  type ActiveSkillBarState,
} from "@/domain/services/clicker-active-skill-slot"
export { oreHitTest, mapPointToImage, buildAlphaMask, ORE_ALPHA_THRESHOLD, type AlphaMask } from "@/domain/services/clicker-ore-hit"
export {
  ADMIN_DEFAULT_MODES,
  clampTutorialStep,
  nextAdminSpeed,
  registerSecretTap,
  SECRET_CODE,
  SECRET_CODE_AMOUNT,
  typedSecretCode,
  type AdminModes,
  type SecretTapState,
} from "@/domain/services/clicker-admin-tools"
export { achievementProgress, autoDrillRate, baseDrillRate, VEIN_LIFETIME_MS, VEIN_SPAWN_CHANCE } from "@/domain/services/clicker-bonus"
export {
  UPGRADE_NAV_TABS,
  buildUpgradeNavTabs,
  stageStationFor,
  upgradeNavAction,
  upgradeNavLabel,
  type StageStation,
  type UpgradeNavAction,
  type UpgradeNavTab,
  type UpgradeNavTabId,
} from "@/domain/services/clicker-upgrade-nav"
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
export {
  REBIRTH_CHOICE_IDLE,
  pickRebirthWorldline,
  rebirthConfirmDelayMs,
  type RebirthChoiceState,
} from "@/domain/services/clicker-rebirth-choice"
export { rebirthKeyframePreloadOrder } from "@/domain/services/clicker-rebirth-keyframes"
export {
  clampSkillMapPan,
  skillMapContentBounds,
  skillMapInitialView,
  type SkillMapMarker,
  type SkillMapRect,
  type SkillMapSize,
  type SkillMapView,
} from "@/domain/services/clicker-skillmap-fit"
