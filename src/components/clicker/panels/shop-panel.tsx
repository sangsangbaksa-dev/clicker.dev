"use client"

import { CurrencyIcon } from "@/components/clicker/clicker-currency-icon"
import type { CurrencyCostView } from "@/application/clicker-ui"
import type { PanelProps } from "./types"
import { ClickerGacha } from "../clicker-gacha"

function CurrencyCosts({ costs }: { costs: CurrencyCostView[] }) {
  return costs.map((c) => (
    <span key={c.regionId} className={`clicker-shop-price is-region${c.enough ? "" : " is-short"}`} title={c.name}>
      <CurrencyIcon regionId={c.regionId} /> <strong>{c.amountText}</strong>
    </span>
  ))
}

export function ClickerShopPanel({ game, run, popIcons, bumpIcon }: PanelProps) {
  return (
    <div className="clicker-shop">
      <ClickerGacha game={game} run={run} />
      <h3 className="clicker-shop-section">물약 · FEVER</h3>
      {game.potionShop.map((item) => {
        const statusClass = item.canBuy ? "is-affordable" : "is-poor"
        const statusLabel = item.canBuy ? "구매 가능" : item.shortReason
        return (
          <article
            key={item.id}
            className={`clicker-card clicker-shop-card ${statusClass}${item.owned > 0 ? " is-stocked" : ""}${(popIcons[item.id] ?? 0) > 0 ? " is-pop-icon" : ""}`}
          >
            <img className="clicker-zoomable" src={item.assetId} alt="" />
            <div className="clicker-shop-body">
              <div className="clicker-shop-title-row">
                <strong>{item.name}</strong>
                <span className={`clicker-shop-status ${statusClass}`}>{statusLabel}</span>
              </div>
              <p className="clicker-shop-effect">
                {item.durationSeconds}초 · {item.effectSummary}
              </p>
              {/* Potion copy often restates the effect line; skip it when it does. */}
              {item.description.startsWith(`${item.durationSeconds}초 ·`) ? null : (
                <p className="clicker-shop-desc">{item.description}</p>
              )}
              <div className="clicker-shop-meta-row">
                <span className="clicker-shop-owned">
                  보유 <strong>{item.owned}</strong>
                </span>
                <span className="clicker-shop-price">
                  <strong>{item.shopCostText}</strong> CORE
                </span>
                <CurrencyCosts costs={item.extraCosts} />
              </div>
            </div>
            <button
              className={`clicker-primary${item.canBuy ? " is-affordable" : " is-unaffordable"}`}
              type="button"
              disabled={!item.canBuy}
              aria-label={`${item.name} 구매 · ${item.shopCostText} CORE · 보유 ${item.owned}`}
              onClick={() => {
                game.buyPotion(item.id)
                bumpIcon(item.id)
              }}
            >
              {item.canBuy ? `구매 · ${item.shopCostText}` : item.shortReason}
            </button>
          </article>
        )
      })}
      <h3 className="clicker-shop-section">액티브 스킬</h3>
      {game.activeSkillShop.map((item) => {
        const statusClass = item.canBuy ? "is-affordable" : "is-poor"
        const statusLabel = item.canBuy ? "구매 가능" : item.shortReason
        return (
          <article
            key={item.id}
            className={`clicker-card clicker-shop-card ${statusClass}${item.owned > 0 ? " is-stocked" : ""}${(popIcons[item.id] ?? 0) > 0 ? " is-pop-icon" : ""}`}
          >
            <img className="clicker-zoomable" src={item.assetId} alt="" />
            <div className="clicker-shop-body">
              <div className="clicker-shop-title-row">
                <strong>{item.name}</strong>
                <span className={`clicker-shop-status ${statusClass}`}>{statusLabel}</span>
              </div>
              <p className="clicker-shop-effect">{item.effectSummary}</p>
              <p className="clicker-shop-desc">{item.description}</p>
              <div className="clicker-shop-meta-row">
                <span className="clicker-shop-owned">
                  보유 <strong>{item.owned}</strong>
                  {" · "}쿨다운 <strong>{item.cooldownSeconds}초</strong>
                </span>
                <span className="clicker-shop-price">
                  <strong>{item.shopCostText}</strong> CORE
                </span>
                <CurrencyCosts costs={item.extraCosts} />
              </div>
            </div>
            <button
              className={`clicker-primary${item.canBuy ? " is-affordable" : " is-unaffordable"}`}
              type="button"
              disabled={!item.canBuy}
              aria-label={`${item.name} 구매 · ${item.shopCostText} CORE · 보유 ${item.owned} · 쿨다운 ${item.cooldownSeconds}초`}
              onClick={() => {
                game.buyActiveSkill(item.id)
                bumpIcon(item.id)
              }}
            >
              {item.canBuy ? `구매 · ${item.shopCostText}` : item.shortReason}
            </button>
          </article>
        )
      })}
    </div>
  )
}
