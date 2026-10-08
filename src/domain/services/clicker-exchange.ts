/**
 * 세계선 교환소 (pure): spare region currency → potion or core burst, with a weekly limit.
 */
import type { ExchangeOfferDef, GameConfig, MetaState, RunState } from "../entities/clicker.ts"
import { exchangeWeek } from "./clicker-exchange-week.ts"
import { isRegionUnlocked, payRegionCurrency } from "./clicker-engine.ts"

export { EXCHANGE_WEEK_MS, exchangeWeek, exchangeWeekStart, sanitizeExchange } from "./clicker-exchange-week.ts"

export function exchangeRemaining(meta: MetaState, offer: ExchangeOfferDef, now: number): number {
  return Math.max(0, offer.weeklyLimit - (exchangeWeek(meta, now).bought[offer.id] ?? 0))
}

function walletFrom(run: RunState, config: GameConfig, regionId: string): number {
  const order = config.regions.filter((r) => r.currency && !r.isHome)
  const start = order.findIndex((r) => r.id === regionId)
  if (start < 0) return 0
  return order.slice(start).reduce((sum, r) => sum + (run.regionCurrency?.[r.id] ?? 0), 0)
}

/** Why an offer cannot be bought now (Korean), or undefined. */
export function exchangeError(
  run: RunState,
  meta: MetaState,
  config: GameConfig,
  offer: ExchangeOfferDef,
  now: number,
): string | undefined {
  const region = config.regions.find((r) => r.id === offer.regionId)
  if (!region?.currency) return "교환할 수 없는 화폐입니다."
  if (!isRegionUnlocked(run, config, region.id)) return `${region.name}을 먼저 여세요.`
  if (exchangeRemaining(meta, offer, now) <= 0) return "이번 주 교환 한도를 다 썼습니다."
  if (offer.reward.kind === "POTION") {
    const id = offer.reward.potionId
    if (!config.potions.some((p) => p.id === id)) return "물약을 찾을 수 없습니다."
  }
  if (offer.reward.kind === "CORE_CAPSULE" && offer.reward.coreAmount <= 0) return "교환할 수 없습니다."
  if (walletFrom(run, config, offer.regionId) < offer.cost) return `${region.currency.name}이 부족합니다.`
  return undefined
}

export type ExchangeOfferView = ExchangeOfferDef & { remaining: number; error?: string }

export function exchangeOffers(
  run: RunState,
  meta: MetaState,
  config: GameConfig,
  offers: ExchangeOfferDef[],
  now: number,
): ExchangeOfferView[] {
  return offers.map((o) => ({ ...o, remaining: exchangeRemaining(meta, o, now), error: exchangeError(run, meta, config, o, now) }))
}

export function buyExchangeOffer(
  run: RunState,
  meta: MetaState,
  config: GameConfig,
  offers: ExchangeOfferDef[],
  offerId: string,
  now: number,
): { run: RunState; meta: MetaState; error?: string } {
  const offer = offers.find((o) => o.id === offerId)
  if (!offer) return { run, meta, error: "교환 품목이 없습니다." }
  const error = exchangeError(run, meta, config, offer, now)
  if (error) return { run, meta, error }
  const wallet = { ...run.regionCurrency }
  if (!payRegionCurrency(wallet, config, offer.regionId, offer.cost)) return { run, meta, error: "화폐가 부족합니다." }
  const week = exchangeWeek(meta, now)
  let nextRun: RunState = { ...run, regionCurrency: wallet }
  const nextMeta: MetaState = {
    ...meta,
    exchange: { weekStart: week.weekStart, bought: { ...week.bought, [offer.id]: (week.bought[offer.id] ?? 0) + 1 } },
  }
  if (offer.reward.kind === "POTION") {
    const id = offer.reward.potionId
    nextRun = { ...nextRun, potions: { ...nextRun.potions, [id]: (nextRun.potions[id] ?? 0) + 1 } }
  } else {
    const gain = offer.reward.coreAmount
    nextRun = {
      ...nextRun,
      coreEnergy: nextRun.coreEnergy + gain,
      lifetimeCoreEnergy: nextRun.lifetimeCoreEnergy + gain,
    }
  }
  return { run: nextRun, meta: nextMeta }
}
