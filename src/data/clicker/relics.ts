import type { RelicDef } from "../../domain/entities/clicker"

/**
 * Relic Vault — the late-game currency sink. Opens from the fourth worldline; every relic is
 * permanent (it survives rebirth) and levels up to six times, each level paid in one world's
 * currency (price in `relicCost`). The final awakening is reserved for the ninth worldline.
 */
export const CLICKER_RELICS: RelicDef[] = [
  {
    id: "relic_heartstone",
    name: "광부의 심장석",
    lore: "첫 광부가 쥐고 있던 붉은 돌. 마지막 세계선에서 심장처럼 다시 뛴다.",
    regionId: "signal_relay",
    maxLevel: 6,
    perLevel: { clickMultiplier: 1.6 },
    assetId: "/clicker/relic/relic_heartstone.webp",
  },
  {
    id: "relic_dynamo",
    name: "꺼지지 않는 발전기",
    lore: "세계선이 무너져도 혼자 돌던 원통. 아홉 번째 선에서 마침내 완전히 깨어난다.",
    regionId: "phase_vault",
    maxLevel: 6,
    perLevel: { productionMultiplier: 1.6 },
    assetId: "/clicker/relic/relic_dynamo.webp",
  },
  {
    id: "relic_storm_eye",
    name: "폭풍의 눈",
    lore: "뇌운 드래곤의 둥지에서 건진 수정. 마지막 공명에 천둥이 답한다.",
    regionId: "storm_spire",
    maxLevel: 6,
    perLevel: { lightningChanceAdd: 0.02, criticalMultiplier: 1.2 },
    assetId: "/clicker/relic/relic_storm_eye.webp",
  },
  {
    id: "relic_hourglass",
    name: "멈춘 모래시계",
    lore: "모래가 떨어지다 멈췄다. 세계선의 끝에서 시간이 다시 흐른다.",
    regionId: "phase_vault",
    maxLevel: 6,
    perLevel: { feverDurationAdd: 3, comboWindowAdd: 0.2 },
    assetId: "/clicker/relic/relic_hourglass.webp",
  },
  {
    id: "relic_warden_fang",
    name: "수호자의 송곳니",
    lore: "심연 거수의 이빨. 마지막 세계선의 드론을 깨운다.",
    regionId: "deep_fault",
    maxLevel: 6,
    perLevel: { droneStrikesPerSecond: 3, echoChanceAdd: 0.02 },
    assetId: "/clicker/relic/relic_warden_fang.webp",
  },
  {
    id: "relic_resonant_fork",
    name: "공명 음차",
    lore: "한 번 치면 광산 전체가 같은 음으로 운다. 마지막 음은 세계선을 흔든다.",
    regionId: "deep_fault",
    maxLevel: 6,
    perLevel: { feverIntensity: 1.15, productionMultiplier: 1.2 },
    assetId: "/clicker/relic/relic_resonant_fork.webp",
  },
]
