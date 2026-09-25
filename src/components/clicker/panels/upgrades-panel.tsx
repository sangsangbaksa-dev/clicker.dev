"use client"

import { useState } from "react"
import { formatNumber } from "@/domain/services/clicker-format"
import type { RunState, UpgradeCategory } from "@/domain/entities/clicker"
import type { ClickerGame } from "./types"

export function ClickerUpgradesPanel({ game, run }: { game: ClickerGame; run: RunState }) {
  const [upgradeCat, setUpgradeCat] = useState<UpgradeCategory>("CLICK")
  return (
    <div className="clicker-upgrades">
      <header className="clicker-upgrades-head">
        <p className="clicker-upgrades-kicker">UPGRADES · 강화</p>
        <p className="clicker-upgrades-lead">
          카테고리별 영구 강화. 보유 CORE <strong>{formatNumber(run.coreEnergy)}</strong>
          {!game.upgrades.some((u) => u.status === "AVAILABLE") ? " · 채굴로 CORE를 더 모으세요" : ""}
        </p>
        <ul className="clicker-upgrades-legend" aria-label="업그레이드 상태">
          <li className="is-affordable">구매 가능</li>
          <li className="is-poor">CORE 부족</li>
          <li className="is-owned">보유</li>
          <li className="is-locked">잠김</li>
        </ul>
      </header>
      <div className="clicker-buy clicker-upgrades-cats" role="tablist" aria-label="업그레이드 카테고리">
        {(
          [
            ["CLICK", "채굴"],
            ["PRODUCTION", "생산"],
            ["FEVER", "FEVER"],
            ["UTILITY", "유틸"],
          ] as const
        ).map(([cat, label]) => (
          <button
            key={cat}
            type="button"
            role="tab"
            aria-selected={upgradeCat === cat}
            aria-label={`${label} 업그레이드`}
            className={upgradeCat === cat ? "clicker-primary" : "clicker-ghost"}
            onClick={() => setUpgradeCat(cat)}
          >
            {label}
          </button>
        ))}
      </div>
      {(() => {
        const list = game.upgrades.filter((u) => u.category === upgradeCat)
        if (list.length === 0) {
          return (
            <p className="clicker-upgrades-empty" role="status">
              이 카테고리에는 아직 표시할 강화가 없습니다. 다른 탭을 확인하세요.
            </p>
          )
        }
        return (
          <>
            {list.every((u) => u.status === "OWNED") ? (
              <p className="clicker-upgrades-empty" role="status">
                이 카테고리 강화를 모두 보유했습니다. 다른 탭이나 채굴로 진행하세요.
              </p>
            ) : null}
            {list.map((u) => {
          const statusClass =
            u.status === "OWNED"
              ? "is-owned"
              : u.status === "LOCKED"
                ? "is-locked"
                : u.status === "POOR"
                  ? "is-poor"
                  : "is-affordable"
          const statusText =
            u.status === "OWNED"
              ? "보유"
              : u.status === "LOCKED"
                ? "잠김"
                : u.status === "POOR"
                  ? "CORE 부족"
                  : "구매 가능"
          const buyLabel =
            u.status === "OWNED"
              ? "보유함"
              : u.status === "LOCKED"
                ? "잠김"
                : u.status === "POOR"
                  ? "CORE 부족"
                  : `구매 · ${u.costText}`
          return (
            <article
              key={u.id}
              className={`clicker-card clicker-upgrade-card ${statusClass}`}
            >
              <div className="clicker-upgrade-body">
                <div className="clicker-upgrade-title-row">
                  <strong>{u.name}</strong>
                  <span className={`clicker-upgrade-status ${statusClass}`}>{statusText}</span>
                </div>
                <p className="clicker-upgrade-desc">{u.description}</p>
                <p className="clicker-upgrade-meta">
                  <span className="clicker-upgrade-price">
                    <strong>{u.costText}</strong> CORE
                  </span>
                  {/* The status badge already says "CORE 부족" / "잠김" — only the locked reason ("조건 미달") adds something. */}
                  {u.status === "LOCKED" && u.reason ? <span className="clicker-upgrade-reason">{u.reason}</span> : null}
                </p>
              </div>
              <button
                className={`clicker-primary${u.status === "AVAILABLE" ? " is-affordable" : " is-unaffordable"}`}
                type="button"
                disabled={u.status !== "AVAILABLE"}
                onClick={() => game.buyUpgrade(u.id)}
              >
                {buyLabel}
              </button>
            </article>
          )
        })}
          </>
        )
      })()}
    </div>
  )
}
