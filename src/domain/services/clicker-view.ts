import type {
  GameConfig,
  InstabilityLevel,
  MetaState,
  ProductionSnapshot,
  RunState,
  SkillBranch,
  UpgradeCategory,
} from "../entities/clicker"
import {
  canRebirth,
  instabilityLevel,
  isProducerUnlocked,
  maxAffordable,
  producerBulkCost,
  producerCost,
  productionSnapshot,
} from "./clicker-engine"
import { formatNumber } from "./clicker-format"

export type CoreVisual = "idle" | "fever" | "crisis"

export type MainHudViewModel = {
  coreEnergyText: string
  productionPerSecondText: string
  comboText: string
  comboRemainText: string
  fever: {
    active: boolean
    ready: boolean
    progress: number
    remainingSeconds: number
    combo: number
    finisherReady: boolean
    phaseLabel: string
  }
  instability: {
    value: number
    level: InstabilityLevel
    label: string
  }
  currentGoal: {
    title: string
    lumaLine: string
    progressText: string
    ratio: number
  }
  coreVisual: CoreVisual
  crisisActive: boolean
  canRebirth: boolean
}

export function buildHud(
  run: RunState,
  meta: MetaState,
  config: GameConfig,
  now: number,
  snapshot?: ProductionSnapshot
): MainHudViewModel {
  const prod = snapshot ?? productionSnapshot(run, meta, config, now)
  const feverOn = run.fever.phase === "FEVER" || run.fever.phase === "IGNITION"
  const feverCooling = run.fever.phase === "COOL_DOWN"
  const obj = config.objectives.find((o) => o.id === run.currentObjectiveId) ?? config.objectives[0]
  let current = 0
  let target = obj?.target ?? 1
  if (obj?.kind === "PRODUCER") current = run.producerLevels[obj.producerId ?? ""] ?? 0
  else if (obj?.kind === "ENERGY") current = run.lifetimeCoreEnergy
  else if (obj?.kind === "FEVER") current = run.feverStarts
  else if (obj?.kind === "SKILL") current = run.ownedSkillNodeIds.length
  else if (obj?.kind === "POTION") current = Object.values(run.potions).reduce((sum, n) => sum + n, 0)
  else current = meta.rebirthCount
  const comboRemain = Math.max(0, (run.combo.expiresAt - now) / 1000)
  const instLevel = instabilityLevel(run.instability)
  const coolDownMax = Math.max(0.001, config.feverCoolDown)
  return {
    coreEnergyText: formatNumber(run.coreEnergy),
    productionPerSecondText: `+${formatNumber(prod.perSecond)}/s`,
    comboText: run.combo.count > 1 ? `콤보 ×${run.combo.count}` : "",
    comboRemainText: run.combo.count > 1 ? `남음 ${comboRemain.toFixed(1)}초` : "",
    fever: {
      active: feverOn,
      ready: !feverOn && run.fever.gauge >= config.feverGaugeMax && run.fever.phase === "IDLE",
      progress: feverOn
        ? run.fever.duration > 0
          ? clampRatio(run.fever.remainingTime / run.fever.duration)
          : 0
        : feverCooling
          ? clampRatio(run.fever.remainingTime / coolDownMax)
          : run.fever.gauge / config.feverGaugeMax,
      remainingSeconds: feverOn || feverCooling ? Math.max(0, run.fever.remainingTime) : 0,
      combo: run.fever.combo,
      finisherReady: run.fever.finisherReady,
      phaseLabel: feverOn
        ? run.fever.finisherReady
          ? "피니셔 준비"
          : `FEVER ×${Math.max(1, run.fever.combo)}`
        : feverCooling
          ? "쿨다운"
          : run.fever.gauge >= config.feverGaugeMax
            ? "FEVER 준비"
            : "FEVER",
    },
    instability: {
      value: run.instability,
      level: instLevel,
      label:
        instLevel === "CRISIS"
          ? "위기"
          : instLevel === "HIGH"
            ? "위험"
            : instLevel === "MID"
              ? "경고"
              : "안정",
    },
    currentGoal: {
      title: obj?.title ?? "",
      lumaLine: obj?.lumaLine ?? "",
      progressText: (() => {
        const base = `${formatNumber(Math.min(current, target))} / ${formatNumber(target)}`
        const done = target > 0 && current >= target
        return done ? `${base} · 완료` : base
      })(),
      ratio: target <= 0 ? 1 : clampRatio(current / target),
    },
    coreVisual: run.crisisActive || run.instability >= 90 ? "crisis" : feverOn ? "fever" : "idle",
    crisisActive: run.crisisActive,
    canRebirth: canRebirth(run, config),
  }
}

function clampRatio(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(1, Math.max(0, n))
}

export type ProducerView = {
  id: string
  name: string
  description: string
  assetId: string
  level: number
  productionText: string
  nextCostText: string
  unlocked: boolean
  canBuy: boolean
  lockReason: string
}

export function buildProducerViews(
  run: RunState,
  meta: MetaState,
  config: GameConfig,
  now: number
): ProducerView[] {
  const snapshot = productionSnapshot(run, meta, config, now)
  return config.producers.map((p) => {
    const level = run.producerLevels[p.id] ?? 0
    const unlocked = isProducerUnlocked(run, config, p.id)
    const cost = producerCost(config, p.id, level)
    const canBuy = unlocked && run.coreEnergy >= cost
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      assetId: p.assetId,
      level,
      productionText: `+${formatNumber(snapshot.byProducer[p.id] ?? 0)} / sec`,
      nextCostText: formatNumber(cost),
      unlocked,
      canBuy,
      lockReason: unlocked ? (canBuy ? "" : "CORE 부족") : `${formatNumber(p.unlockAt)} CORE 해금`,
    }
  })
}

export function bulkCostText(run: RunState, config: GameConfig, producerId: string, mode: 1 | 10 | "MAX"): string {
  const level = run.producerLevels[producerId] ?? 0
  const n = mode === "MAX" ? maxAffordable(config, producerId, level, run.coreEnergy) : mode
  return formatNumber(producerBulkCost(config, producerId, level, Math.max(1, n)))
}

/** Whether the bulk buy mode is affordable (unlocked + enough CORE). No balance change. */
export function bulkAffordable(
  run: RunState,
  config: GameConfig,
  producerId: string,
  mode: 1 | 10 | "MAX",
): boolean {
  if (!isProducerUnlocked(run, config, producerId)) return false
  const level = run.producerLevels[producerId] ?? 0
  if (mode === "MAX") return maxAffordable(config, producerId, level, run.coreEnergy) >= 1
  return run.coreEnergy >= producerBulkCost(config, producerId, level, mode)
}

export type UpgradeView = {
  id: string
  name: string
  description: string
  category: UpgradeCategory
  costText: string
  status: "AVAILABLE" | "OWNED" | "LOCKED" | "POOR"
  reason: string
}

export function buildUpgradeViews(run: RunState, config: GameConfig): UpgradeView[] {
  return config.upgrades.map((u) => {
    const owned = run.ownedUpgradeIds.includes(u.id)
    const reqFail =
      (u.unlockProducerId && (run.producerLevels[u.unlockProducerId] ?? 0) <= 0) ||
      (u.unlockFeverStarts && run.feverStarts < u.unlockFeverStarts)
    let status: UpgradeView["status"] = "AVAILABLE"
    let reason = ""
    if (owned) {
      status = "OWNED"
      reason = "보유함"
    } else if (reqFail) {
      status = "LOCKED"
      reason = "조건 미달"
    } else if (run.coreEnergy < u.cost) {
      status = "POOR"
      reason = "CORE 부족"
    }
    return {
      id: u.id,
      name: u.name,
      description: u.description,
      category: u.category,
      costText: formatNumber(u.cost),
      status,
      reason,
    }
  })
}

export type PotionShopView = {
  id: string
  name: string
  description: string
  assetId: string
  shopCostText: string
  owned: number
  canBuy: boolean
  durationSeconds: number
  effectSummary: string
}

export type ActiveSkillShopView = {
  id: string
  name: string
  description: string
  assetId: string
  shopCostText: string
  owned: number
  canBuy: boolean
  effectSummary: string
  cooldownSeconds: number
}

export type SkillNodeView = {
  id: string
  name: string
  description: string
  branch: SkillBranch
  tier: number
  cost: number
  requires: string[]
  status: "OWNED" | "AVAILABLE" | "POOR" | "LOCKED"
  canBuy: boolean
}

export function buildSkillNodeViews(run: RunState, config: GameConfig): SkillNodeView[] {
  return config.skillNodes.map((node) => {
    const owned = run.ownedSkillNodeIds.includes(node.id)
    const requires = node.requires ?? []
    const prereqsMet = requires.every((id) => run.ownedSkillNodeIds.includes(id))
    let status: SkillNodeView["status"] = "LOCKED"
    if (owned) status = "OWNED"
    else if (!prereqsMet) status = "LOCKED"
    else if (run.coreEnergy < node.cost) status = "POOR"
    else status = "AVAILABLE"
    return {
      id: node.id,
      name: node.name,
      description: node.description,
      branch: node.branch,
      tier: node.tier,
      cost: node.cost,
      requires,
      status,
      canBuy: status === "AVAILABLE",
    }
  })
}

function potionEffectSummary(potion: {
  clickMultiplier: number
  productionMultiplier: number
  criticalChanceAdd?: number
  instabilityPerSecond?: number
}): string {
  const parts: string[] = []
  if (potion.clickMultiplier !== 1) parts.push(`채굴 ×${trimMult(potion.clickMultiplier)}`)
  if (potion.productionMultiplier !== 1) parts.push(`생산 ×${trimMult(potion.productionMultiplier)}`)
  if (potion.criticalChanceAdd) parts.push(`치명타 +${Math.round(potion.criticalChanceAdd * 100)}%`)
  if (potion.instabilityPerSecond) parts.push(`불안정 +${potion.instabilityPerSecond}/초`)
  return parts.join(" · ") || "효과 없음"
}

function trimMult(n: number): string {
  return Number.isInteger(n) ? String(n) : trimZerosLocal(n.toFixed(2))
}

function trimZerosLocal(text: string): string {
  return text.replace(/\.?0+$/, "")
}

function activeSkillEffectSummary(skill: {
  duration: number
  cooldown: number
  productionMultiplier?: number
  clickMultiplier?: number
  energyBurstSeconds?: number
  instabilityPerSecond?: number
  instabilityDelta?: number
}): string {
  const parts: string[] = []
  if (skill.energyBurstSeconds) parts.push(`즉시 생산 ${skill.energyBurstSeconds}초분`)
  if (skill.productionMultiplier != null && skill.productionMultiplier !== 1) {
    parts.push(`생산 ×${trimMult(skill.productionMultiplier)}`)
  }
  if (skill.clickMultiplier != null && skill.clickMultiplier !== 1) {
    parts.push(`채굴 ×${trimMult(skill.clickMultiplier)}`)
  }
  if (skill.instabilityDelta) {
    parts.push(`불안정 ${skill.instabilityDelta > 0 ? "+" : ""}${skill.instabilityDelta}`)
  }
  if (skill.instabilityPerSecond) parts.push(`불안정 +${skill.instabilityPerSecond}/초`)
  if (skill.duration > 0) parts.push(`${skill.duration}초`)
  if (skill.cooldown > 0) parts.push(`쿨다운 ${skill.cooldown}초`)
  return parts.join(" · ") || "효과 없음"
}

export function buildPotionShopViews(run: RunState, config: GameConfig): PotionShopView[] {
  return [...config.potions]
    .sort((a, b) => a.shopCost - b.shopCost)
    .map((potion) => ({
      id: potion.id,
      name: potion.name,
      description: potion.description,
      assetId: potion.assetId,
      shopCostText: formatNumber(potion.shopCost),
      owned: run.potions[potion.id] ?? 0,
      canBuy: run.coreEnergy >= potion.shopCost,
      durationSeconds: potion.duration,
      effectSummary: potionEffectSummary(potion),
    }))
}

export type RegionView = {
  id: string
  name: string
  description: string
  bgAssetId: string
  /** Short status line: 시작 지역 / 해금됨 / 잠김 · 남은 N */
  unlockText: string
  /** Threshold requirement shown even when unlocked (e.g. "250K 누적 CORE") */
  unlockRequirement: string
  bonusText: string
  unlocked: boolean
  isHome: boolean
  isCurrent: boolean
}

function regionBonusText(region: {
  clickMultiplier?: number
  productionMultiplier?: number
}): string {
  const parts: string[] = []
  if (region.clickMultiplier && region.clickMultiplier !== 1) {
    const pct = Math.round((region.clickMultiplier - 1) * 100)
    parts.push(`채굴 +${pct}%`)
  }
  if (region.productionMultiplier && region.productionMultiplier !== 1) {
    const pct = Math.round((region.productionMultiplier - 1) * 100)
    parts.push(`생산 +${pct}%`)
  }
  return parts.length > 0 ? parts.join(" · ") : "보너스 없음"
}

export function buildRegionViews(run: RunState, config: GameConfig): RegionView[] {
  return config.regions.map((region) => {
    const unlocked = run.lifetimeCoreEnergy >= region.unlockAtLifetimeEnergy
    const threshold = region.unlockAtLifetimeEnergy
    const remaining = Math.max(0, threshold - run.lifetimeCoreEnergy)
    const unlockRequirement =
      threshold <= 0 ? "시작 시 개방" : `${formatNumber(threshold)} 누적 CORE`
    const unlockText =
      threshold <= 0
        ? "시작 지역 · 홈"
        : unlocked
          ? "해금됨"
          : `잠김 · 남은 ${formatNumber(remaining)}`
    return {
      id: region.id,
      name: region.name,
      description: region.description,
      bgAssetId: region.bgAssetId,
      unlockText,
      unlockRequirement,
      bonusText: regionBonusText(region),
      unlocked,
      isHome: Boolean(region.isHome),
      isCurrent: run.currentRegionId === region.id,
    }
  })
}

export function buildActiveSkillShopViews(run: RunState, config: GameConfig): ActiveSkillShopView[] {
  return [...config.activeSkills]
    .sort((a, b) => a.shopCost - b.shopCost)
    .map((skill) => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      assetId: skill.assetId,
      shopCostText: formatNumber(skill.shopCost),
      owned: run.skillItems[skill.id] ?? 0,
      canBuy: run.coreEnergy >= skill.shopCost,
      effectSummary: activeSkillEffectSummary(skill),
      cooldownSeconds: skill.cooldown,
    }))
}
