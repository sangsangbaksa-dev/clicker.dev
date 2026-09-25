import type { RegionDef } from "../../domain/entities/clicker"

/**
 * Playable stage regions — unlock via lifetime CORE.
 * Bonuses apply only while the player is present in that region
 * (`run.currentRegionId`); rebirth returns home → Core Mine bias.
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
  },
  {
    id: "phase_vault",
    name: "Phase Vault",
    description: "깊은 공명이 먼지처럼 쌓인 보관소. CORE 맥동의 잔향이 오래 남습니다.",
    bgAssetId: "/clicker/bg/region_phase_vault.png",
    unlockAtLifetimeEnergy: 2_000_000,
    clickMultiplier: 1.08,
    productionMultiplier: 1.1,
  },
]
