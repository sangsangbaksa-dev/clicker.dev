import type { ExchangeOfferDef } from "@/domain/entities/clicker"

/**
 * 세계선 교환소 offers. 미확정(밸런스 STOP): 아래 cost·weeklyLimit 상수 3개는 임시값이며 사용자 확정 후 교체.
 */
export const EXCHANGE_PLACEHOLDER_COST = 1_000
export const EXCHANGE_PLACEHOLDER_WEEKLY_LIMIT = 3
export const EXCHANGE_PLACEHOLDER_CAPSULE_WEEKLY_LIMIT = 1
export const EXCHANGE_CORE_CAPSULE_AMOUNT = 50_000

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
    description: `남는 월드 화폐로 즉시 코어 에너지 ${EXCHANGE_CORE_CAPSULE_AMOUNT.toLocaleString("ko-KR")}를 받습니다.`,
    regionId: "signal_relay",
    cost: EXCHANGE_PLACEHOLDER_COST,
    weeklyLimit: EXCHANGE_PLACEHOLDER_CAPSULE_WEEKLY_LIMIT,
    reward: { kind: "CORE_CAPSULE", coreAmount: EXCHANGE_CORE_CAPSULE_AMOUNT },
  },
]
