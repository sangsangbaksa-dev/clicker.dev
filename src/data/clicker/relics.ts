import type { RelicDef } from "../../domain/entities/clicker"

/**
 * Relic Vault — the late-game currency sink. Opens from the fourth worldline; every relic is
 * permanent (it survives rebirth) and levels up to five times, each level paid in one world's
 * currency (price in `relicCost`).
 */
export const CLICKER_RELICS: RelicDef[] = [
  {
    id: "relic_heartstone",
    name: "광부의 심장석",
    lore: "첫 광부가 쥐고 있던 붉은 돌. 쥔 손이 멈추지 않는다.",
    regionId: "signal_relay",
    maxLevel: 5,
    perLevel: { clickMultiplier: 1.6 },
    assetId: "/clicker/relic/relic_heartstone.webp",
  },
  {
    id: "relic_dynamo",
    name: "꺼지지 않는 발전기",
    lore: "세계선이 무너져도 혼자 돌고 있던 작은 원통.",
    regionId: "phase_vault",
    maxLevel: 5,
    perLevel: { productionMultiplier: 1.6 },
    assetId: "/clicker/relic/relic_dynamo.webp",
  },
  {
    id: "relic_storm_eye",
    name: "폭풍의 눈",
    lore: "뇌운 드래곤의 둥지에서 건진 수정. 안에서 아직 천둥이 친다.",
    regionId: "storm_spire",
    maxLevel: 5,
    perLevel: { lightningChanceAdd: 0.02, criticalMultiplier: 1.2 },
    assetId: "/clicker/relic/relic_storm_eye.webp",
  },
  {
    id: "relic_hourglass",
    name: "멈춘 모래시계",
    lore: "모래가 떨어지다 멈췄다. 그 사이에 시간이 남는다.",
    regionId: "phase_vault",
    maxLevel: 5,
    perLevel: { feverDurationAdd: 3, comboWindowAdd: 0.2 },
    assetId: "/clicker/relic/relic_hourglass.webp",
  },
  {
    id: "relic_warden_fang",
    name: "수호자의 송곳니",
    lore: "심연 거수의 이빨. 이것을 문 드론은 겁이 없다.",
    regionId: "deep_fault",
    maxLevel: 5,
    perLevel: { droneStrikesPerSecond: 3, echoChanceAdd: 0.02 },
    assetId: "/clicker/relic/relic_warden_fang.webp",
  },
  {
    id: "relic_resonant_fork",
    name: "공명 음차",
    lore: "한 번 치면 광산 전체가 같은 음으로 운다.",
    regionId: "deep_fault",
    maxLevel: 5,
    perLevel: { feverIntensity: 1.15, productionMultiplier: 1.2 },
    assetId: "/clicker/relic/relic_resonant_fork.webp",
  },
]
