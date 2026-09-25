import type { RegionDef } from "../../domain/entities/clicker"

/**
 * Playable stage regions — unlock via lifetime CORE.
 * Bonuses apply only while the player is present in that region
 * (`run.currentRegionId`); rebirth returns home → Core Mine bias.
 * Each non-home region also has one activity usable only while standing there.
 */
export const CLICKER_REGIONS: RegionDef[] = [
  {
    id: "core_chamber",
    name: "Core Mine",
    description: "코어 광맥이 드러난 AURELIA의 채굴 거점. 모든 세계선의 시작점입니다.",
    bgAssetId: "/clicker/bg/region_core_chamber.png",
    unlockAtLifetimeEnergy: 0,
    isHome: true,
    clickMultiplier: 1.05,
  },
  {
    id: "signal_relay",
    name: "Signal Relay",
    description: "코어에서 뻗어 나간 중계 복도. 잔향이 벽면을 타고 흐릅니다.",
    bgAssetId: "/clicker/bg/region_signal_relay.png",
    unlockAtLifetimeEnergy: 250_000,
    productionMultiplier: 1.12,
    activity: {
      kind: "PRODUCTION_BOOST",
      name: "주파수 증폭",
      description: "60초 동안 생산 ×2.5 · 재사용 4분",
      cooldownSec: 240,
      durationSec: 60,
      multiplier: 2.5,
    },
  },
  {
    id: "phase_vault",
    name: "Phase Vault",
    description: "깊은 공명이 먼지처럼 쌓인 보관소. CORE 맥동의 잔향이 오래 남습니다.",
    bgAssetId: "/clicker/bg/region_phase_vault.png",
    unlockAtLifetimeEnergy: 2_000_000,
    clickMultiplier: 1.08,
    productionMultiplier: 1.1,
    activity: {
      kind: "PHASE_DEPOSIT",
      name: "위상 예치",
      description: "보유 CORE의 50%를 예치 · 3분 뒤 ×1.5로 자동 회수 · 재사용 4분",
      cooldownSec: 240,
      durationSec: 180,
      depositShare: 0.5,
      multiplier: 1.5,
    },
  },
  {
    id: "storm_spire",
    name: "Storm Spire",
    description: "번개가 멎지 않는 첨탑. 채굴 레이저가 낙뢰를 끌어당깁니다.",
    bgAssetId: "/clicker/mine/mine_interior_hitech_v1.png",
    unlockAtLifetimeEnergy: 30_000_000,
    clickMultiplier: 1.15,
    lightningChanceAdd: 0.08,
    activity: {
      kind: "LIGHTNING_STORM",
      name: "낙뢰 소환",
      description: "20초 동안 모든 채굴이 번개 스트라이크 · 재사용 3분",
      cooldownSec: 180,
      durationSec: 20,
    },
  },
  {
    id: "deep_fault",
    name: "Deep Fault",
    description: "행성 깊이 갈라진 단층. 한 번의 타격이 지각을 울립니다.",
    bgAssetId: "/clicker/mine/mine_interior_mineral_ore_v2.png",
    unlockAtLifetimeEnergy: 400_000_000,
    productionMultiplier: 1.2,
    quakeIntervalReduce: 5,
    activity: {
      kind: "PRODUCTION_BURST",
      name: "지각 붕괴",
      description: "현재 생산 2분치를 즉시 획득 · 재사용 5분",
      cooldownSec: 300,
      productionSeconds: 120,
    },
  },
  {
    id: "drone_foundry",
    name: "Drone Foundry",
    description: "버려진 드론 공장. 격납고마다 채굴 드론이 잠들어 있습니다.",
    bgAssetId: "/clicker/mine/mine_scene_core_chamber_v1.png",
    unlockAtLifetimeEnergy: 5_000_000_000,
    productionMultiplier: 1.15,
    droneEfficiencyAdd: 1,
    activity: {
      kind: "DRONE_SWARM",
      name: "드론 사출",
      description: "60초 동안 드론 타격 ×5 · 재사용 4분",
      cooldownSec: 240,
      durationSec: 60,
      multiplier: 5,
    },
  },
]
