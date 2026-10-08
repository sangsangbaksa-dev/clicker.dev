"use client"

import { useState } from "react"
import { bulkAffordable, bulkCostText } from "@/application/clicker-ui"
import type { PanelProps } from "@/hooks/use-clicker"

export function ClickerProducersPanel({ game, run, popIcons, bumpIcon, automationBuff }: PanelProps & { automationBuff: boolean }) {
  const [selectedProducerId, setSelectedProducerId] = useState<string | null>(null)
  const [showLocked, setShowLocked] = useState(false)
  // Unlocked producers, then the next one to aim for; the rest wait behind a single row.
  const firstLocked = game.producers.findIndex((p) => !p.unlocked)
  const visible = showLocked || firstLocked < 0 ? game.producers : game.producers.slice(0, firstLocked + 1)
  const hidden = game.producers.length - visible.length
  return (
    <div className="clicker-producers">
      {visible.map((p) => {
        const selected = selectedProducerId === p.id
        const statusClass = !p.unlocked ? "is-locked" : p.canBuy ? "is-affordable" : "is-poor"
        const statusLabel = !p.unlocked ? "잠김" : p.canBuy ? "구매 가능" : "CORE 부족"
        const sharePct = Math.round(p.share * 100)
        return (
          <article
            key={p.id}
            className={`clicker-card clicker-producer-card ${statusClass}${p.level > 0 ? " is-live" : ""}${p.level > 0 && automationBuff ? " is-dense" : ""}${selected ? " is-selected" : ""}${(popIcons[p.id] ?? 0) > 0 ? " is-pop-icon" : ""}`}
            aria-current={selected ? "true" : undefined}
            onClick={() => setSelectedProducerId(p.id)}
          >
            <span className="clicker-producer-icon">
              <img className="clicker-zoomable" src={p.assetId} alt="" />
              {p.level > 0 ? <b className="clicker-producer-level">{p.level}</b> : null}
            </span>
            <div className="clicker-producer-body">
              <div className="clicker-producer-title-row">
                <strong>{p.name}</strong>
                <span className={`clicker-producer-status ${statusClass}`}>{statusLabel}</span>
              </div>
              <p className="clicker-producer-effect">
                Lv. {p.level} · <em>{p.productionText}</em>
              </p>
              {p.level > 0 ? (
                <div className="clicker-producer-share" aria-label={`생산 비중 ${sharePct}%`}>
                  <i style={{ width: `${Math.max(2, sharePct)}%` }} />
                  <span>생산 비중 {sharePct}%</span>
                </div>
              ) : (
                <p className="clicker-producer-cost">
                  {p.unlocked ? (
                    <>
                      다음 <strong>{p.nextCostText}</strong> CORE
                    </>
                  ) : (
                    <>
                      누적 <strong>{p.lockReason}</strong>
                    </>
                  )}
                </p>
              )}
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
                    <span className="clicker-buy-cost">{bulkCostText(run, game.config, p.id, buyMode)}</span>
                  </button>
                )
              })}
            </div>
          </article>
        )
      })}
      {hidden > 0 ? (
        <button type="button" className="clicker-producers-more" onClick={() => setShowLocked(true)}>
          잠긴 생산자 {hidden}개 더 보기
        </button>
      ) : showLocked && firstLocked >= 0 ? (
        <button type="button" className="clicker-producers-more" onClick={() => setShowLocked(false)}>
          잠긴 생산자 접기
        </button>
      ) : null}
    </div>
  )
}
