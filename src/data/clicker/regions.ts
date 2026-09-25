import type { RegionDef } from "../../domain/entities/clicker"

/**
 * Playable stage regions — unlock via lifetime CORE.
 * Bonuses apply only while the player is present in that region
 * (`run.currentRegionId`); rebirth returns home → Core Mine bias.
 *
 * Each region's timed session earns differently (`activity`). Balance, held by
 * clicker-region-activity.test.ts: later regions out-earn Core Mine in sessions
 * (×1.1 hunt, ×1.2 vault for the reference player), and Relay vs Vault trade
 * off — Relay keeps the better idle bonus, Vault the better active one.
 */
export const CLICKER_REGIONS: RegionDef[] = [
  {
    id: "core_chamber",
    name: "Core Mine",
    description: "코어 광맥이 드러난 AURELIA의 채굴 거점. 모든 세계선의 시작점입니다.",
    bgAssetId: "/clicker/bg/region_core_chamber.png",
    unlockAtLifetimeEnergy: 0,
    isHome: true,
    activity: "mine",
    clickMultiplier: 1.05,
  },
  {
    id: "signal_relay",
    name: "Signal Relay",
    description: "코어에서 뻗어 나간 중계 복도. 오염된 신호체가 배회합니다.",
    bgAssetId: "/clicker/bg/region_signal_relay.png",
    unlockAtLifetimeEnergy: 250_000,
    activity: "hunt",
    productionMultiplier: 1.12,
  },
  {
    id: "phase_vault",
    name: "Phase Vault",
    description: "깊은 공명이 먼지처럼 쌓인 보관소. 위상 자물쇠를 풀어 봉인된 CORE를 꺼냅니다.",
    bgAssetId: "/clicker/bg/region_phase_vault.png",
    unlockAtLifetimeEnergy: 2_000_000,
    activity: "vault",
    clickMultiplier: 1.08,
    productionMultiplier: 1.1,
  },
]
