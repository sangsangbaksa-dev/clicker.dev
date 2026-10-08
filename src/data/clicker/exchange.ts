import type { ExchangeOfferDef } from "../../domain/entities/clicker.ts"

/**
 * 세계선 교환소 offers. 미확정(밸런스 STOP): 아래 cost·weeklyLimit 상수 3개는 임시값이며 사용자 확정 후 교체.
 * limit but gives no prices. `cost` and `weeklyLimit` below are placeholders awaiting a balance call;
 * they touch no existing curve (relic costs, gacha, production stay as they are).
 */
export const EXCHANGE_PLACEHOLDER_COST = 1_000 // 미확정
export const EXCHANGE_PLACEHOLDER_WEEKLY_LIMIT = 3 // 미확정
export const EXCHANGE_PLACEHOLDER_CAPSULE_WEEKLY_LIMIT = 1 // 미확정
export const CLICKER_EXCHANGE_OFFERS: ExchangeOfferDef[] = [
  {
    id: "exchange_timebreak",
    name: "Time Break Potion",
    description: "남는 월드 화폐로 물약 하나를 받으세요.",
    regionId: "signal_relay",
    cost: EXCHANGE_PLACEHOLDER_COST,
    weeklyLimit: EXCHANGE_PLACEHOLDER_WEEKLY_LIMIT,
    reward: { kind: "POTION", potionId: "timebreak" },
  },
  {
    id: "exchange_free_capsule",
    name: "무료 코어 캡슐",
    description: "오늘의 무료 캡슐을 바로 다시 열 수 있게 하세요.",
    regionId: "signal_relay",
    cost: EXCHANGE_PLACEHOLDER_COST,
    weeklyLimit: EXCHANGE_PLACEHOLDER_CAPSULE_WEEKLY_LIMIT,
    reward: { kind: "FREE_CAPSULE" },
  },
]
