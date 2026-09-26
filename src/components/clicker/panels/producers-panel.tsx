"use client"

import { useState } from "react"
import { formatNumber } from "@/domain/services/clicker-format"
import { bulkAffordable, bulkCostText } from "@/domain/services/clicker-view"
import type { PanelProps } from "./types"

export function ClickerProducersPanel({ game, run, popIcons, bumpIcon, automationBuff }: PanelProps & { automationBuff: boolean }) {
  const [selectedProducerId, setSelectedProducerId] = useState<string | null>(null)
  return (
    <div className="clicker-producers">
      <header className="clicker-producers-head">
        <p className="clicker-producers-kicker">PRODUCERS · 생산</p>
        <p className="clicker-producers-lead">
          보유 CORE <strong>{formatNumber(run.coreEnergy)}</strong>
          {game.snapshot ? ` · +${formatNumber(game.snapshot.perSecond)}/s` : ""}
          {!game.producers.some((p) => p.canBuy) ? " · 채굴로 CORE를 더 모으세요" : ""}
        </p>
        <ul className="clicker-producers-legend" aria-label="상태 안내">
          <li className="is-affordable">구매 가능</li>
          <li className="is-poor">CORE 부족</li>
          <li className="is-locked">잠김</li>
        </ul>
      </header>
      {game.producers.map((p) => {
        const selected = selectedProducerId === p.id
        const statusClass = !p.unlocked ? "is-locked" : p.canBuy ? "is-affordable" : "is-poor"
        const statusLabel = !p.unlocked ? "잠김" : p.canBuy ? "구매 가능" : "CORE 부족"
        return (
          <article
            key={p.id}
            className={`clicker-card clicker-producer-card ${statusClass}${p.level > 0 ? " is-live" : ""}${p.level > 0 && automationBuff ? " is-dense" : ""}${selected ? " is-selected" : ""}${(popIcons[p.id] ?? 0) > 0 ? " is-pop-icon" : ""}`}
            aria-current={selected ? "true" : undefined}
            onClick={() => setSelectedProducerId(p.id)}
          >
            <img src={p.assetId} alt="" />
            <div className="clicker-producer-body">
              <div className="clicker-producer-title-row">
                <strong>{p.name}</strong>
                <span className={`clicker-producer-status ${statusClass}`}>{statusLabel}</span>
              </div>
              <p className="clicker-producer-effect">
                Lv. {p.level} · <em>{p.productionText}</em>
              </p>
              <p className="clicker-producer-cost">
                {/* The status badge already says "CORE 부족" / "잠김" — don't repeat it here. */}
                {p.unlocked ? (
                  <>
                    다음 <strong>{p.nextCostText}</strong> CORE
                    {p.waitText ? <span className="clicker-producer-wait"> · {p.waitText}</span> : null}
                  </>
                ) : (
                  <>
                    누적 <strong>{p.lockReason}</strong>
                  </>
                )}
              </p>
            </div>
            <div className="clicker-buy" onClick={(e) => e.stopPropagation()}>
              {(["1", "10", "MAX"] as const).map((mode) => {
                const buyMode = mode === "MAX" ? "MAX" : mode === "10" ? 10 : 1
                const affordable = bulkAffordable(run, game.config, p.id, buyMode)
                return (
                  <button
                    key={mode}
                    className={`clicker-primary${affordable ? " is-affordable" : " is-unaffordable"}`}
                    type="button"
                    disabled={!p.unlocked || !affordable}
                    aria-label={`${p.name} ${mode === "MAX" ? "최대" : `×${mode}`} · ${bulkCostText(run, game.config, p.id, buyMode)} CORE`}
                    onClick={() => {
                      setSelectedProducerId(p.id)
                      bumpIcon(p.id)
                      game.buyProducer(p.id, buyMode)
                    }}
                  >
                    {mode === "MAX" ? "최대" : `×${mode}`}
                    <span className="clicker-buy-cost">
                      {bulkCostText(run, game.config, p.id, buyMode)}
                    </span>
                  </button>
                )
              })}
            </div>
          </article>
        )
      })}
    </div>
  )
}
