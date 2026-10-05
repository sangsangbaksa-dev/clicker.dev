import type {
  ActiveSkillDef,
  GameConfig,
  PotionDef,
  ProducerDef,
  SkillBranch,
  SkillNodeDef,
  UpgradeDef,
} from "../../domain/entities/clicker"
import { nameSkillNode } from "./skill-names.ts"

/**
 * Catalog additions: more producers, per-producer upgrade tiers, side circuits, potions and
 * active skills. Values are in the catalog's raw unit; `finalizeCatalog` scales them with
 * everything else.
 */

export const EXTRA_PRODUCERS: ProducerDef[] = [
  { id: "spark_coil", name: "Spark Coil", description: "작은 불꽃을 모아 둔다.", unlockAt: 30, baseCost: 2_000, productionPerSecond: 2.2, costGrowth: 1.16, tags: ["EARLY", "LINK"], assetId: "/clicker/producer/producer_spark_coil.webp" },
  { id: "ion_pump", name: "Ion Pump", description: "이온 흐름을 끌어올린다.", unlockAt: 1_200, baseCost: 70_000, productionPerSecond: 15, costGrowth: 1.172, tags: ["CORE", "STABLE"], assetId: "/clicker/producer/producer_ion_pump.webp" },
  { id: "prism_loom", name: "Prism Loom", description: "빛을 짜서 에너지로 만든다.", unlockAt: 40_000, baseCost: 2_000_000, productionPerSecond: 110, costGrowth: 1.198, tags: ["AUTOMATION", "MID"], assetId: "/clicker/producer/producer_prism_loom.webp" },
  { id: "gravity_well", name: "Gravity Well", description: "중력으로 잔향을 끌어모은다.", unlockAt: 5_000_000, baseCost: 200_000_000, productionPerSecond: 3_100, costGrowth: 1.215, tags: ["RESONANCE", "MID"], assetId: "/clicker/producer/producer_gravity_well.webp" },
  { id: "nova_forge", name: "Nova Forge", description: "작은 신성을 불러 주조한다.", unlockAt: 4_000_000_000, baseCost: 110_000_000_000, productionPerSecond: 240_000, costGrowth: 1.24, tags: ["END", "LATE"], assetId: "/clicker/producer/producer_nova_forge.webp" },
  { id: "aurora_reactor", name: "Aurora Reactor", description: "코어 심장과 공명하는 마지막 반응로.", unlockAt: 15_000_000_000, baseCost: 500_000_000_000, productionPerSecond: 650_000, costGrowth: 1.245, tags: ["END", "RISK"], assetId: "/clicker/producer/producer_aurora_reactor.webp" },
  // Late producers: they only exist from their worldline on, each a step above the last.
  { id: "star_anvil", name: "Star Anvil", description: "붙잡은 별 위에서 코어를 두드려 벼리는 모루.", unlockAt: 100_000_000_000, baseCost: 3_000_000_000_000, productionPerSecond: 3_500_000, costGrowth: 1.25, tags: ["END"], requiresWorldLine: 6, assetId: "/clicker/producer/producer_star_anvil.webp" },
  { id: "worldline_loom", name: "Worldline Loom", description: "지나온 세계선들을 실로 뽑아 한 장으로 짜는 베틀.", unlockAt: 600_000_000_000, baseCost: 20_000_000_000_000, productionPerSecond: 20_000_000, costGrowth: 1.255, tags: ["END"], requiresWorldLine: 7, assetId: "/clicker/producer/producer_worldline_loom.webp" },
  { id: "heart_engine", name: "Heart Engine", description: "코어 심장의 박동을 그대로 옮겨 심은 기관.", unlockAt: 4_000_000_000_000, baseCost: 150_000_000_000_000, productionPerSecond: 120_000_000, costGrowth: 1.26, tags: ["END"], requiresWorldLine: 8, assetId: "/clicker/producer/producer_heart_engine.webp" },
]

/** Two ×2 tiers per producer (skipping ids the base catalog already upgrades once). */
export function producerUpgradeTiers(producers: ProducerDef[], existing: UpgradeDef[]): UpgradeDef[] {
  const out: UpgradeDef[] = []
  const has = new Set(existing.map((u) => u.producerId).filter(Boolean))
  for (const p of producers) {
    if (!has.has(p.id)) {
      out.push({
        id: `${p.id}_tune`,
        name: `${p.name} Tuning`,
        description: `${p.name} ×2`,
        category: "PRODUCTION",
        cost: p.baseCost * 20,
        productionMultiplier: 2,
        producerId: p.id,
        unlockProducerId: p.id,
        ...(p.requiresWorldLine ? { assetId: p.assetId } : {}),
      })
    }
    out.push({
      id: `${p.id}_overdrive`,
      name: `${p.name} Overdrive`,
      description: `${p.name} ×2`,
      category: "PRODUCTION",
      cost: p.baseCost * 400,
      productionMultiplier: 2,
      producerId: p.id,
      unlockProducerId: p.id,
      ...(p.requiresWorldLine ? { assetId: p.assetId } : {}),
    })
  }
  return out
}

export const EXTRA_UPGRADES: UpgradeDef[] = [
  // Region drill: shorter cooldown between bores, and fewer taps per bore (faster drilling).
  { id: "drill_coolant", name: "Drill Coolant", description: "시추 냉각 -5초", category: "UTILITY", cost: 3_000_000, drillCooldownReduceSec: 5 },
  { id: "drill_bit", name: "Diamond Bit", description: "시추 속도 증가 · 필요 탭 -5", category: "UTILITY", cost: 6_000_000, drillTapsReduce: 5 },
  { id: "drill_cryo", name: "Cryo Loop", description: "시추 냉각 -7초", category: "UTILITY", cost: 60_000_000, drillCooldownReduceSec: 7 },
  { id: "drill_turbine", name: "Turbine Head", description: "시추 속도 증가 · 필요 탭 -5", category: "UTILITY", cost: 150_000_000, drillTapsReduce: 5 },
  { id: "drill_superconduct", name: "Superconductor", description: "시추 냉각 -8초", category: "UTILITY", cost: 3_000_000_000, drillCooldownReduceSec: 8 },
  { id: "drill_plasma", name: "Plasma Bore", description: "시추 속도 증가 · 필요 탭 -5", category: "UTILITY", cost: 8_000_000_000, drillTapsReduce: 5 },
  { id: "grip_tape", name: "Grip Tape", description: "채굴 ×1.3", category: "CLICK", cost: 800, clickMultiplier: 1.3 },
  { id: "lens_polish", name: "Lens Polish", description: "채굴 ×1.4", category: "CLICK", cost: 8_000, clickMultiplier: 1.4 },
  { id: "beam_split", name: "Beam Split", description: "채굴 ×1.6", category: "CLICK", cost: 120_000, clickMultiplier: 1.6 },
  { id: "keen_eye", name: "Keen Eye", description: "치명타 +4%", category: "CLICK", cost: 60_000, criticalChanceAdd: 0.04 },
  { id: "heavy_focus", name: "Heavy Focus", description: "치명타 배율 ×1.5", category: "CLICK", cost: 6_000_000, criticalMultiplier: 1.5 },
  { id: "combo_band", name: "Combo Band", description: "콤보 상한 +5", category: "CLICK", cost: 900_000, comboMaxAdd: 5 },
  { id: "photon_drill", name: "Photon Drill", description: "채굴 ×3", category: "CLICK", cost: 2_000_000_000, clickMultiplier: 3 },
  { id: "star_cutter", name: "Star Cutter", description: "채굴 ×4", category: "CLICK", cost: 300_000_000_000, clickMultiplier: 4 },
  { id: "void_edge", name: "Void Edge", description: "채굴 ×5", category: "CLICK", cost: 30_000_000_000_000, clickMultiplier: 5 },
  { id: "warm_up", name: "Warm Up", description: "FEVER +3초", category: "FEVER", cost: 5_000, feverDurationAdd: 3 },
  { id: "fever_core", name: "Fever Core", description: "FEVER 배율 +20%", category: "FEVER", cost: 20_000_000, feverIntensity: 1.2 },
  { id: "fever_long", name: "Long Burn", description: "FEVER +6초", category: "FEVER", cost: 150_000_000, feverDurationAdd: 6 },
  { id: "fever_blaze", name: "Blaze Heart", description: "FEVER 배율 +40%", category: "FEVER", cost: 10_000_000_000, feverIntensity: 1.4 },
  { id: "fever_crown", name: "Fever Crown", description: "피니셔 보상 ×2", category: "FEVER", cost: 500_000_000_000, finisherReward: 2 },
  { id: "wire_clean", name: "Wire Clean", description: "전체 생산 ×1.1", category: "UTILITY", cost: 3_000, productionMultiplier: 1.1 },
  { id: "heat_sink", name: "Heat Sink", description: "전체 생산 ×1.25", category: "UTILITY", cost: 1_500_000, productionMultiplier: 1.25 },
  { id: "grid_sync", name: "Grid Sync", description: "전체 생산 ×1.5", category: "UTILITY", cost: 400_000_000, productionMultiplier: 1.5 },
  { id: "core_lattice", name: "Core Lattice", description: "전체 생산 ×2", category: "UTILITY", cost: 50_000_000_000, productionMultiplier: 2 },
  { id: "world_engine", name: "World Engine", description: "전체 생산 ×1.8", category: "UTILITY", cost: 20_000_000_000_000, productionMultiplier: 1.8 },
]

type NodeSpec = [id: string, branch: SkillBranch, tier: number, name: string, cost: number, requires: string, effect: Partial<SkillNodeDef>, description: string]

const NODE_SPECS: NodeSpec[] = [
  ["focus_grip", "FOCUS", 1, "Firm Grip", 4_500, "focus_click", { clickMultiplier: 1.1 }, "채굴 ×1.1"],
  ["focus_tempo", "FOCUS", 1, "Tempo", 9_000, "focus_grip", { comboMaxAdd: 5 }, "콤보 상한 +5"],
  ["focus_sharp", "FOCUS", 2, "Sharp Eye", 150_000, "focus_tempo", { criticalChanceAdd: 0.03 }, "치명타 +3%"],
  ["focus_heavy", "FOCUS", 2, "Heavy Hand", 600_000, "focus_sharp", { clickMultiplier: 1.3 }, "채굴 ×1.3"],
  ["focus_split", "FOCUS", 3, "Split Beam", 8_000_000, "focus_heavy", { clickMultiplier: 1.4 }, "채굴 ×1.4"],
  ["focus_deep", "FOCUS", 3, "Deep Bite", 70_000_000, "focus_split", { criticalMultiplier: 1.3 }, "치명타 배율 ×1.3"],
  ["focus_titan", "FOCUS", 4, "Titan Arm", 1_200_000_000, "focus_deep", { clickMultiplier: 1.8 }, "채굴 ×1.8"],
  ["focus_star", "FOCUS", 5, "Star Breaker", 40_000_000_000, "focus_titan", { clickMultiplier: 2.5 }, "채굴 ×2.5"],
  ["mine_quick", "FOCUS", 1, "Steady Swing", 12_000, "mine_dwell", { lightningChanceAdd: 0.02 }, "번개 +2%"],
  ["mine_turn", "FOCUS", 2, "Fast Turnaround", 400_000, "mine_quick", { cooldownReduceSec: 5 }, "광산·시추 대기 -5초"],
  ["mine_lamp", "FOCUS", 2, "Head Lamp", 500_000, "mine_turn", { clickMultiplier: 1.15 }, "채굴 ×1.15"],
  ["storm_static", "FOCUS", 2, "Static Hair", 900_000, "storm_spark", { lightningChanceAdd: 0.02 }, "번개 +2%"],
  ["storm_arc", "FOCUS", 3, "Arc Flash", 35_000_000, "storm_static", { lightningMultiplierAdd: 2 }, "번개 배율 +2"],
  ["quake_step", "FOCUS", 2, "Heavy Step", 1_200_000, "quake_tremor", { quakeMultiplierAdd: 3 }, "지진파 배율 +3"],
  ["echo_ring", "FOCUS", 3, "Ring Echo", 6_000_000, "echo_double", { echoChanceAdd: 0.04 }, "잔향 +4%"],
  ["auto_oil", "AUTOMATION", 1, "Oil Line", 7_000, "auto_prod", { productionMultiplier: 1.1 }, "생산 ×1.1"],
  ["auto_belt", "AUTOMATION", 1, "Conveyor", 10_000, "auto_oil", { productionMultiplier: 1.15 }, "생산 ×1.15"],
  ["auto_cool", "AUTOMATION", 2, "Coolant Loop", 300_000, "auto_belt", { cooldownReduceSec: 5, monsterRespawnReduce: 5 }, "광산·시추·크리처 대기 -5초"],
  ["auto_gear", "AUTOMATION", 2, "Gear Train", 250_000, "auto_belt", { productionMultiplier: 1.2 }, "생산 ×1.2"],
  ["auto_press", "AUTOMATION", 2, "Hydraulic Press", 2_000_000, "auto_gear", { productionMultiplier: 1.25 }, "생산 ×1.25"],
  ["auto_robot", "AUTOMATION", 3, "Robot Arm", 30_000_000, "auto_press", { productionMultiplier: 1.35 }, "생산 ×1.35"],
  ["auto_ai", "AUTOMATION", 4, "Plant AI", 900_000_000, "auto_robot", { productionMultiplier: 1.6 }, "생산 ×1.6"],
  ["auto_mega", "AUTOMATION", 5, "Megastructure", 60_000_000_000, "auto_ai", { productionMultiplier: 1.4 }, "생산 ×1.4"],
  ["auto_end2", "AUTOMATION", 5, "Nova Tap", 80_000_000_000, "auto_end", { productionMultiplier: 1.8, producerTag: "END" }, "END 생산자 ×1.8"],
  ["drone_bay", "AUTOMATION", 3, "Drone Bay", 15_000_000, "drone_pair", { droneStrikesPerSecond: 1 }, "드론 +1회/초"],
  ["drone_ai", "AUTOMATION", 4, "Swarm Brain", 800_000_000, "drone_bay", { droneEfficiencyAdd: 0.5 }, "드론 효율 +50%"],
  ["reso_hum", "RESONANCE", 1, "Low Hum", 8_000, "reso_fever", { feverDurationAdd: 2 }, "FEVER +2초"],
  ["reso_glow", "RESONANCE", 1, "Afterglow", 14_000, "reso_hum", { feverIntensity: 1.1 }, "FEVER 강도 +10%"],
  ["reso_choir", "RESONANCE", 2, "Choir", 350_000, "reso_glow", { productionMultiplier: 1.15 }, "생산 ×1.15"],
  ["reso_bell", "RESONANCE", 2, "Bell Tone", 1_800_000, "reso_choir", { clickMultiplier: 1.2 }, "채굴 ×1.2"],
  ["reso_wave2", "RESONANCE", 3, "Standing Wave", 25_000_000, "reso_bell", { feverIntensity: 1.2 }, "FEVER 강도 +20%"],
  ["reso_peak", "RESONANCE", 4, "Peak Harmony", 700_000_000, "reso_wave2", { productionMultiplier: 1.4 }, "생산 ×1.4"],
  ["reso_crown", "RESONANCE", 5, "Harmonic Crown", 50_000_000_000, "reso_peak", { clickMultiplier: 1.8, productionMultiplier: 1.8 }, "채굴·생산 ×1.8"],
  ["reso_risk", "RESONANCE", 3, "Edge Dance", 20_000_000, "reso_edge", { instabilityRewardBonus: 0.1 }, "생산 +10%"],
  ["trans_spark", "TRANSCENDENCE", 1, "Memory Spark", 25_000, "trans_start", { startingEnergy: 20 }, "다음 런 시작 +20 CORE"],
  ["trans_kin", "TRANSCENDENCE", 2, "Kinship", 400_000, "trans_spark", { clickMultiplier: 1.2 }, "채굴 ×1.2"],
  ["trans_flow", "TRANSCENDENCE", 2, "World Flow", 1_500_000, "trans_kin", { productionMultiplier: 1.2 }, "생산 ×1.2"],
  ["trans_deep", "TRANSCENDENCE", 3, "Deep Memory", 40_000_000, "trans_flow", { clickMultiplier: 1.3, productionMultiplier: 1.3 }, "채굴·생산 ×1.3"],
  ["hunt_start", "HUNT", 1, "Hunter's Mark", 16_000_000, "", { monsterRewardMultiplier: 1.5 }, "크리처 보상 ×1.5"],
  ["hunt_track", "HUNT", 1, "Tracker", 45_000_000, "hunt_start", { monsterRespawnReduce: 5 }, "크리처 재등장 -5초"],
  ["hunt_blade", "HUNT", 2, "Serrated Edge", 200_000_000, "hunt_track", { monsterRewardMultiplier: 1.6 }, "크리처 보상 ×1.6"],
  ["hunt_bait", "HUNT", 2, "Ore Bait", 470_000_000, "hunt_blade", { monsterRespawnReduce: 5 }, "크리처 재등장 -5초"],
  ["hunt_trophy", "HUNT", 2, "Trophy Wall", 690_000_000, "hunt_blade", { clickMultiplier: 1.15 }, "채굴 ×1.15"],
  ["hunt_pack", "HUNT", 3, "Pack Tactics", 2_200_000_000, "hunt_bait", { monsterRewardMultiplier: 2 }, "크리처 보상 ×2"],
  ["hunt_lure", "HUNT", 3, "Resonant Lure", 3_500_000_000, "hunt_pack", { monsterRespawnReduce: 5 }, "크리처 재등장 -5초"],
  ["hunt_pelt", "HUNT", 3, "Crystal Pelts", 4_400_000_000, "hunt_trophy", { productionMultiplier: 1.2 }, "생산 ×1.2"],
  // Creature damage line: every strike in a lair hits harder (×7 across the line), the late ones also the guardian.
  ["hunt_claw", "HUNT", 2, "Rending Claws", 320_000_000, "hunt_blade", { lairDamageMultiplier: 1.1, assetId: "/clicker/skill-node/hunt_blade.webp" }, "크리처 피해 ×1.1"],
  ["hunt_fang", "HUNT", 2, "Fang Strike", 900_000_000, "hunt_claw", { lairDamageMultiplier: 1.1, assetId: "/clicker/skill-node/hunt_track.webp" }, "크리처 피해 ×1.1"],
  ["hunt_frenzy", "HUNT", 3, "Blood Frenzy", 2_800_000_000, "hunt_fang", { lairDamageMultiplier: 1.15, assetId: "/clicker/skill-node/hunt_pack.webp" }, "크리처 피해 ×1.15"],
  ["hunt_pierce", "HUNT", 3, "Armor Pierce", 5_500_000_000, "hunt_frenzy", { lairDamageMultiplier: 1.15, bossDamageMultiplier: 1.2, assetId: "/clicker/skill-node/focus_breaker.webp" }, "크리처 피해 ×1.15 · 수호자 피해 ×1.2"],
  ["hunt_cleave", "HUNT", 3, "Cleave", 8_000_000_000, "hunt_pierce", { lairDamageMultiplier: 1.2, assetId: "/clicker/skill-node/focus_heavy.webp" }, "크리처 피해 ×1.2"],
  ["hunt_execute", "HUNT", 4, "Executioner", 20_000_000_000, "hunt_cleave", { lairDamageMultiplier: 1.2, bossDamageMultiplier: 1.3, assetId: "/clicker/skill-node/focus_lethal.webp" }, "크리처 피해 ×1.2 · 수호자 피해 ×1.3"],
  ["hunt_rampage", "HUNT", 4, "Rampage", 40_000_000_000, "hunt_execute", { lairDamageMultiplier: 1.25, assetId: "/clicker/skill-node/hunt_slayer.webp" }, "크리처 피해 ×1.25"],
  ["hunt_titanslayer", "HUNT", 4, "Titan Slayer", 70_000_000_000, "hunt_rampage", { lairDamageMultiplier: 1.25, bossDamageMultiplier: 1.4, assetId: "/clicker/skill-node/focus_titan.webp" }, "크리처 피해 ×1.25 · 수호자 피해 ×1.4"],
  ["hunt_wrath", "HUNT", 5, "Hunter's Wrath", 110_000_000_000, "hunt_titanslayer", { lairDamageMultiplier: 1.3, bossDamageMultiplier: 1.5, assetId: "/clicker/skill-node/hunt_bane.webp" }, "크리처 피해 ×1.3 · 수호자 피해 ×1.5"],
  ["hunt_godslayer", "HUNT", 5, "Godslayer", 250_000_000_000, "hunt_wrath", { lairDamageMultiplier: 1.5, bossDamageMultiplier: 2, assetId: "/clicker/skill-node/hunt_apex.webp" }, "크리처 피해 ×1.5 · 수호자 피해 ×2"],
  ["hunt_slayer", "HUNT", 4, "Slayer", 16_000_000_000, "hunt_lure", { monsterRewardMultiplier: 2.5 }, "크리처 보상 ×2.5"],
  ["hunt_bane", "HUNT", 4, "Warden's Bane", 29_000_000_000, "hunt_slayer", { bossDamageMultiplier: 1.5 }, "수호자 피해 ×1.5"],
  ["hunt_apex", "HUNT", 5, "Apex Predator", 150_000_000_000, "hunt_bane", { bossDamageMultiplier: 2, monsterRewardMultiplier: 3 }, "수호자 피해 ×2 · 크리처 보상 ×3"],
  // The tree's final key: one purchase that redraws the whole economy.
  ["trans_heart", "TRANSCENDENCE", 5, "Heart Key", 1_000_000_000_000, "trans_convergence", { clickMultiplier: 3, productionMultiplier: 3, criticalMultiplier: 2, droneStrikesPerSecond: 5 }, "채굴·생산 ×3 · 치명타 배율 ×2 · 드론 +5회/초"],
]

export const EXTRA_SKILL_NODES: SkillNodeDef[] = NODE_SPECS.map(([id, branch, tier, name, cost, requires, effect, description]) => ({
  id,
  branch,
  tier,
  name,
  cost,
  requires: requires ? [requires] : [],
  description,
  ...effect,
}))

export const EXTRA_POTIONS: PotionDef[] = [
  { id: "spark", name: "Spark Tonic", description: "8초 · 채굴 ×1.8 · 치명타 +3%", duration: 8, clickMultiplier: 1.8, productionMultiplier: 1, criticalChanceAdd: 0.03, instabilityPerSecond: 0, shopCost: 60_000, assetId: "/clicker/potion/potion_spark.webp" },
  { id: "keen", name: "Keen Elixir", description: "15초 · 채굴 ×3 · 치명타 +15%", duration: 15, clickMultiplier: 3, productionMultiplier: 1, criticalChanceAdd: 0.15, instabilityPerSecond: 0, shopCost: 4_000_000, assetId: "/clicker/potion/potion_keen.webp" },
  { id: "golden", name: "Golden Draught", description: "60초 · 채굴 ×3 · 치명타 +3%", duration: 60, clickMultiplier: 3, productionMultiplier: 1, criticalChanceAdd: 0.03, instabilityPerSecond: 0, shopCost: 120_000_000, assetId: "/clicker/potion/potion_golden.webp" },
]

export const EXTRA_ACTIVE_SKILLS: ActiveSkillDef[] = [
  { id: "laser_focus", name: "LASER FOCUS", description: "10초 채굴 ×4", cooldown: 40, duration: 10, shopCost: 40_000, clickMultiplier: 4, assetId: "/clicker/skill/skill_laser_focus.webp" },
  { id: "time_warp", name: "TIME WARP", description: "채굴 800회분 CORE를 즉시 획득", cooldown: 60, duration: 0, shopCost: 300_000, clickBurst: 800, assetId: "/clicker/skill/skill_time_warp.webp" },
  { id: "grid_boost", name: "GRID BOOST", description: "20초 채굴 ×2", cooldown: 60, duration: 20, shopCost: 150_000, clickMultiplier: 2, assetId: "/clicker/skill/skill_grid_boost.webp" },
  { id: "crit_surge", name: "CRIT SURGE", description: "8초 치명타 확률 +60%", cooldown: 50, duration: 8, shopCost: 120_000, criticalChanceAdd: 0.6, assetId: "/clicker/skill/skill_crit_surge.webp" },
  { id: "thunder_call", name: "THUNDER CALL", description: "10초 동안 모든 타격에 번개", cooldown: 70, duration: 10, shopCost: 220_000, lightningStorm: true, assetId: "/clicker/skill/skill_thunder_call.webp" },
  { id: "fever_ignite", name: "FEVER IGNITE", description: "FEVER를 즉시 점화", cooldown: 90, duration: 0, shopCost: 260_000, feverIgnite: true, assetId: "/clicker/skill/skill_fever_ignite.webp" },
  { id: "cryo_purge", name: "CRYO PURGE", description: "불안정도 -50 · 다른 스킬 쿨다운 초기화", cooldown: 120, duration: 0, shopCost: 400_000, instabilityDelta: -50, cooldownReset: true, assetId: "/clicker/skill/skill_cryo_purge.webp" },
]

/**
 * AUTOMATION circuits hit harder than their raw numbers: the production bonus part of every
 * multiplier ×1.75 (×1.2 → ×1.35, ×2 → ×2.75), assist drill and drone strikes ×1.5, drone
 * efficiency ×1.5. Unlock and producer-list descriptions pick up the new numbers.
 */
const AUTOMATION_BONUS_SCALE = 1.75
const AUTOMATION_STRIKE_SCALE = 1.5

function boostAutomation(n: SkillNodeDef): SkillNodeDef {
  if (n.branch !== "AUTOMATION") return n
  const round2 = (v: number) => Math.round(v * 100) / 100
  const out: SkillNodeDef = { ...n }
  if (n.productionMultiplier) out.productionMultiplier = round2(Math.round((1 + (n.productionMultiplier - 1) * AUTOMATION_BONUS_SCALE) * 20) / 20)
  if (n.autoDrillPerSecond) out.autoDrillPerSecond = Math.ceil(n.autoDrillPerSecond * AUTOMATION_STRIKE_SCALE)
  if (n.droneStrikesPerSecond) out.droneStrikesPerSecond = Math.ceil(n.droneStrikesPerSecond * AUTOMATION_STRIKE_SCALE)
  if (n.droneEfficiencyAdd) out.droneEfficiencyAdd = round2(n.droneEfficiencyAdd * AUTOMATION_STRIKE_SCALE)
  out.description = n.description
    .replace(/생산자 ×[\d.]+/, `생산자 ×${out.productionMultiplier}`)
    .replace(/초당 \d+회/, `초당 ${out.autoDrillPerSecond ?? out.droneStrikesPerSecond}회`)
  return out
}

/** Raw prices are cut by this before the unit change: cheaper items, more of them. */
export const PRICE_CUT = 0.5
/** Display/economy unit: everything earned and spent is divided by 1000. */
export const CORE_UNIT = 1 / 1000

/**
 * Late producers carry the END / LATE / RISK circuits (up to ×238 stacked), which made each
 * new one pay for itself faster than the tier before it — the first Nova Forge alone lifted
 * income ×69. These factors set their fully-upgraded payback on a steady climb
 * (Resonance Array ≈ 4.7k s → Void 6k → … → Heart Engine 30k), so every new producer is a
 * step up, never a jump.
 */
const LATE_PRODUCTION_SCALE: Record<string, number> = {
  void_condenser: 0.15,
  singularity_plant: 0.18,
  horizon_engine: 0.067,
  nova_forge: 0.098,
  aurora_reactor: 0.22,
  star_anvil: 0.25,
  worldline_loom: 0.25,
  heart_engine: 0.2,
}

/** Every producer's base output (×2 over the earlier catalog). */
const PRODUCER_OUTPUT = 2

/** The rebirth (TRANSCENDENCE) circuits start at 200M and climb steeply from there. */
const TRANSCENDENCE_FIRST_COST = 2e8
const TRANSCENDENCE_COST_CURVE = 0.6

/** Re-prices the TRANSCENDENCE branch: cheapest = TRANSCENDENCE_FIRST_COST, order kept. */
function priceTranscendence<T extends { branch: string; cost: number }>(nodes: T[]): T[] {
  const branch = nodes.filter((n) => n.branch === "TRANSCENDENCE")
  if (!branch.length) return nodes
  const min = Math.min(...branch.map((n) => n.cost))
  return nodes.map((n) =>
    n.branch === "TRANSCENDENCE" ? { ...n, cost: Math.round(TRANSCENDENCE_FIRST_COST * (n.cost / min) ** TRANSCENDENCE_COST_CURVE) } : n,
  )
}

/**
 * Merge the extras, give every upgrade/circuit its own icon, sort by price, then apply the
 * price cut and the unit change to every CORE amount in the catalog.
 */
export function finalizeCatalog(base: GameConfig): GameConfig {
  const producers = [...base.producers, ...EXTRA_PRODUCERS].sort((a, b) => a.baseCost - b.baseCost)
  const upgrades = [...base.upgrades, ...EXTRA_UPGRADES]
  upgrades.push(...producerUpgradeTiers(producers, upgrades))
  const u = CORE_UNIT
  const c = CORE_UNIT * PRICE_CUT
  return {
    ...base,
    baseClick: base.baseClick * u,
    rebirthEnergy: base.rebirthEnergy * u,
    producers: producers.map((p) => ({
      ...p,
      baseCost: p.baseCost * c,
      unlockAt: p.unlockAt * c,
      productionPerSecond: p.productionPerSecond * u * PRODUCER_OUTPUT * (LATE_PRODUCTION_SCALE[p.id] ?? 1),
    })),
    upgrades: upgrades
      .map((x) => ({ ...x, cost: x.cost * c, assetId: x.assetId ?? `/clicker/upgrade/${x.id}.webp` }))
      .sort((a, b) => a.cost - b.cost),
    skillNodes: priceTranscendence(
      [...base.skillNodes, ...EXTRA_SKILL_NODES].map(boostAutomation).map(nameSkillNode).map((n) => ({
        ...n,
        cost: n.cost * c,
        startingEnergy: n.startingEnergy === undefined ? undefined : n.startingEnergy * u,
        assetId: n.assetId ?? `/clicker/skill-node/${n.id}.webp`,
      })),
    ),
    potions: [...base.potions, ...EXTRA_POTIONS].map((p) => ({ ...p, shopCost: p.shopCost * c })).sort((a, b) => a.shopCost - b.shopCost),
    activeSkills: [...base.activeSkills, ...EXTRA_ACTIVE_SKILLS]
      .map((s) => ({ ...s, shopCost: s.shopCost * c }))
      .sort((a, b) => a.shopCost - b.shopCost),
    objectives: base.objectives.map((o) => (o.kind === "ENERGY" ? { ...o, target: o.target * u } : o)),
    transcendence: base.transcendence.map((t) => ({
      ...t,
      startingEnergy: t.startingEnergy === undefined ? undefined : t.startingEnergy * u,
    })),
    regions: base.regions.map((r) => ({ ...r, unlockAtLifetimeEnergy: r.unlockAtLifetimeEnergy * u })),
    achievements: base.achievements.map((a) =>
      a.kind === "LIFETIME" || a.kind === "MINE_HAUL" ? { ...a, target: a.target * u } : a,
    ),
  }
}
