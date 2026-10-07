"use client"

import { formatNumber } from "@/application/clicker-ui"
import type { ClickerGame } from "./panels/types"

/** 세계선 교환소: spare world currency → items, weekly limit. */
export function ClickerExchange({ game, now }: { game: ClickerGame; now: number }) {
  const offers = game.exchangeOffers(now)
  if (offers.length === 0) return null
  return (
    <section className="clicker-forge clicker-exchange" aria-labelledby="clicker-exchange-title">
      <h3 id="clicker-exchange-title" className="clicker-world-title">세계선 교환소</h3>
      <p className="clicker-forge-summary">남는 월드 화폐를 물약이나 캡슐로 바꾸세요. 품목마다 주간 한도가 있고, 월요일에 다시 채워집니다.</p>
      <ul className="clicker-forge-slots" role="list">
        {offers.map((o) => {
          const region = game.config.regions.find((r) => r.id === o.regionId)
          const currency = region?.currency?.name ?? "월드 화폐"
          const label = `${o.name} 교환하기 — ${currency} ${formatNumber(o.cost)}, 이번 주 ${o.remaining}회 남음`
          return (
            <li key={o.id} className="clicker-forge-slot">
              <p className="clicker-forge-label">
                {o.name} <small>이번 주 {o.remaining}/{o.weeklyLimit}</small>
              </p>
              <p className="clicker-relic-lore">{o.description}</p>
              <p className="clicker-forge-cost">
                {currency} {formatNumber(o.cost)}
              </p>
              <button
                type="button"
                className="clicker-primary"
                disabled={Boolean(o.error)}
                aria-disabled={Boolean(o.error)}
                aria-label={o.error ? `${label} (${o.error})` : label}
                title={o.error}
                onClick={() => game.buyExchange(o.id)}
              >
                {o.error ?? "교환하기"}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
