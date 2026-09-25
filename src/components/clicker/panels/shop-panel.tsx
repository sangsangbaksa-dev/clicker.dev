"use client"

import { formatNumber } from "@/domain/services/clicker-format"
import type { PanelProps } from "./types"

export function ClickerShopPanel({ game, run, popIcons, bumpIcon }: PanelProps) {
  return (
    <div className="clicker-shop">
      <header className="clicker-shop-head">
        <p className="clicker-shop-lead">
          기억을 잃은 채 방에 갇혀 있습니다. LUMA가 남긴 상점에서 물약과 일회용 스킬을 되찾을 수 있습니다.
        </p>
        <p className="clicker-shop-wallet">
          보유 CORE <strong>{formatNumber(run.coreEnergy)}</strong>
          {game.snapshot ? ` · +${formatNumber(game.snapshot.perSecond)}/s` : ""}
          {!game.potionShop.some((p) => p.canBuy) && !game.activeSkillShop.some((s) => s.canBuy)
            ? " · 채굴로 CORE를 더 모으세요"
            : ""}
        </p>
        <ul className="clicker-shop-legend" aria-label="상점 상태">
          <li className="is-affordable">구매 가능</li>
          <li className="is-poor">CORE 부족</li>
          <li className="is-stocked">보유 있음</li>
        </ul>
      </header>
      <h3 className="clicker-shop-section">물약 · FEVER</h3>
      {game.potionShop.map((item) => {
        const statusClass = item.canBuy ? "is-affordable" : "is-poor"
        const statusLabel = item.canBuy ? "구매 가능" : "CORE 부족"
        return (
          <article
            key={item.id}
            className={`clicker-card clicker-shop-card ${statusClass}${item.owned > 0 ? " is-stocked" : ""}${(popIcons[item.id] ?? 0) > 0 ? " is-pop-icon" : ""}`}
          >
            <img src={item.assetId} alt="" />
            <div className="clicker-shop-body">
              <div className="clicker-shop-title-row">
                <strong>{item.name}</strong>
                <span className={`clicker-shop-status ${statusClass}`}>{statusLabel}</span>
              </div>
              <p className="clicker-shop-effect">
                {item.durationSeconds}초 · {item.effectSummary}
              </p>
              <p className="clicker-shop-desc">{item.description}</p>
              <div className="clicker-shop-meta-row">
                <span className="clicker-shop-owned">
                  보유 <strong>{item.owned}</strong>
                </span>
                <span className="clicker-shop-price">
                  <strong>{item.shopCostText}</strong> CORE
                </span>
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
              {item.canBuy ? `구매 · ${item.shopCostText}` : "CORE 부족"}
            </button>
          </article>
        )
      })}
      <h3 className="clicker-shop-section">액티브 스킬</h3>
      {game.activeSkillShop.map((item) => {
        const statusClass = item.canBuy ? "is-affordable" : "is-poor"
        const statusLabel = item.canBuy ? "구매 가능" : "CORE 부족"
        return (
          <article
            key={item.id}
            className={`clicker-card clicker-shop-card ${statusClass}${item.owned > 0 ? " is-stocked" : ""}${(popIcons[item.id] ?? 0) > 0 ? " is-pop-icon" : ""}`}
          >
            <img src={item.assetId} alt="" />
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
              {item.canBuy ? `구매 · ${item.shopCostText}` : "CORE 부족"}
            </button>
          </article>
        )
      })}
    </div>
  )
}
