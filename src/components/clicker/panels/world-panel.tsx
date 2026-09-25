"use client"

import { CLICKER_ASSETS } from "@/data/clicker/catalog"
import { formatNumber } from "@/domain/services/clicker-format"
import type { RunState } from "@/domain/entities/clicker"
import type { ClickerGame } from "./types"

export function ClickerWorldPanel({ game, run, onBack }: { game: ClickerGame; run: RunState; onBack: () => void }) {
  return (
    <div className="clicker-world">
      <header className="clicker-world-head">
        <div className="clicker-world-head-row">
          <p className="clicker-world-kicker">WORLD · 이동</p>
          <button
            type="button"
            className="clicker-ghost clicker-world-back"
            aria-keyshortcuts="Escape"
            onClick={onBack}
          >
            ← 광산으로 · Esc
          </button>
        </div>
        <h3 className="clicker-world-title">지역 이동</h3>
        <p className="clicker-world-lead">
          현재 위치{" "}
          <strong className="clicker-world-here-name">
            {game.currentRegion?.name ?? "Core Mine"}
          </strong>
          {game.currentRegion?.isHome ? " · 홈" : ""}
          {game.currentRegion?.bonusText ? ` · ${game.currentRegion.bonusText}` : ""}
        </p>
        <p className="clicker-world-meta">
          누적 CORE <strong>{formatNumber(run.lifetimeCoreEnergy)}</strong>
          {" · "}
          해금 {game.regions.filter((r) => r.unlocked).length}/{game.regions.length}
          {" · "}해금 조건은 각 목적지 카드에 표시됩니다
        </p>
        {(() => {
          const nextLocked = game.regions.find((r) => !r.unlocked)
          if (!nextLocked) {
            return (
              <p className="clicker-world-next" role="status">
                모든 지역이 해금되었습니다. 목적지를 선택해 이동하세요.
              </p>
            )
          }
          return (
            <p className="clicker-world-next" role="status">
              다음 해금 후보 · <strong>{nextLocked.name}</strong>
              {" — "}
              {nextLocked.unlockText}
              {" · "}필요 {nextLocked.unlockRequirement}
            </p>
          )
        })()}
      </header>
      <div className="clicker-world-list">
        {game.regions.map((region) => {
          const regionTip = `${region.name} — ${region.description} (${region.unlockText} · ${region.unlockRequirement})`
          return (
            <span key={region.id} className="clicker-world-slot">
              <article
                className={`clicker-card clicker-world-card${region.isCurrent ? " is-current" : ""}${!region.unlocked ? " is-locked" : ""}`}
                aria-label={regionTip}
                aria-current={region.isCurrent ? "location" : undefined}
              >
                <img
                  src={region.bgAssetId || CLICKER_ASSETS.bgChamber}
                  alt=""
                  onError={(e) => {
                    e.currentTarget.src = CLICKER_ASSETS.bgChamber
                  }}
                />
                <div className="clicker-world-card-body">
                  <strong className="clicker-world-dest-name">{region.name}</strong>
                  <p className="clicker-world-dest-desc">{region.description}</p>
                  <p className="clicker-world-dest-bonus">{region.bonusText}</p>
                  <p className="clicker-world-dest-unlock">
                    <span className="clicker-world-dest-unlock-status">{region.unlockText}</span>
                    <span className="clicker-world-dest-unlock-req">
                      필요 {region.unlockRequirement}
                    </span>
                  </p>
                </div>
                {region.isCurrent ? (
                  <span className="clicker-world-here" aria-label="현재 위치">
                    현재 위치
                  </span>
                ) : region.unlocked ? (
                  <button
                    className="clicker-primary"
                    type="button"
                    title={regionTip}
                    aria-label={`${region.name}(으)로 이동`}
                    onClick={() => game.travelRegion(region.id)}
                  >
                    {region.isHome ? "홈으로 이동" : "이동하기"}
                  </button>
                ) : (
                  <button
                    className="clicker-ghost clicker-world-locked-btn"
                    type="button"
                    disabled
                    title={regionTip}
                    aria-label={`${region.name} 잠김 — ${region.unlockText} · 필요 ${region.unlockRequirement}`}
                  >
                    잠김 · 조건 미달
                  </button>
                )}
              </article>
              <span className="clicker-world-tip" role="tooltip">
                <strong>{region.name}</strong>
                {region.description}
                <em className="clicker-world-tip-meta">
                  {region.unlockText} · 필요 {region.unlockRequirement}
                </em>
              </span>
            </span>
          )
        })}
      </div>
      {!game.currentRegion?.isHome ? (
        <button className="clicker-primary clicker-world-home" type="button" onClick={() => game.returnHome()}>
          ← Core Mine으로 돌아가기
        </button>
      ) : null}
    </div>
  )
}
