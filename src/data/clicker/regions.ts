import type { RegionDef } from "../../domain/entities/clicker"

/**
 * Playable stage regions — unlock via lifetime CORE.
 * Bonuses apply only while the player is present in that region
 * (`run.currentRegionId`); rebirth returns home → Core Mine bias.
 * The timed mine exists only at home; every other region has one activity usable only
 * while standing there, and the later regions add a hands-on `challenge` mini-game.
 * `intro` plays on every entry into the region.
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
    intro: { video: "/clicker/region/signal_relay_intro.mp4", poster: "/clicker/bg/region_signal_relay.png" },
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
    intro: { video: "/clicker/region/phase_vault_intro.mp4", poster: "/clicker/bg/region_phase_vault.png" },
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
    bgAssetId: "/clicker/bg/region_storm_spire.jpg",
    intro: { video: "/clicker/region/storm_spire_intro.mp4", poster: "/clicker/bg/region_storm_spire.jpg" },
    unlockAtLifetimeEnergy: 30_000_000,
    clickMultiplier: 1.15,
    lightningChanceAdd: 0.08,
    challenge: {
      kind: "ROD_STRIKE",
      name: "피뢰침 포획",
      description: "빛나는 피뢰침을 번개가 치기 전에 눌러 전하를 포획 · 15초",
      durationSec: 15,
      rewardSeconds: 90,
      cooldownSec: 180,
    },
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
    bgAssetId: "/clicker/bg/region_deep_fault.jpg",
    intro: { video: "/clicker/region/deep_fault_intro.mp4", poster: "/clicker/bg/region_deep_fault.jpg" },
    unlockAtLifetimeEnergy: 400_000_000,
    productionMultiplier: 1.2,
    quakeIntervalReduce: 5,
    challenge: {
      kind: "FAULT_DRILL",
      name: "단층 시추",
      description: "압력 바늘이 녹색 구간에 올 때 시추 · 성공할수록 구간이 좁아짐 · 15초",
      durationSec: 15,
      rewardSeconds: 120,
      cooldownSec: 180,
    },
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
    bgAssetId: "/clicker/bg/region_drone_foundry.jpg",
    intro: { video: "/clicker/region/drone_foundry_intro.mp4", poster: "/clicker/bg/region_drone_foundry.jpg" },
    unlockAtLifetimeEnergy: 5_000_000_000,
    productionMultiplier: 1.15,
    droneEfficiencyAdd: 1,
    challenge: {
      kind: "DRONE_RECALL",
      name: "드론 회수",
      description: "격납고를 가로지르는 드론을 눌러 회수 · 15초",
      durationSec: 15,
      rewardSeconds: 90,
      cooldownSec: 180,
    },
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
