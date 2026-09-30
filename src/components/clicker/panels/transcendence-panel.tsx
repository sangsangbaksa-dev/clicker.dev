"use client"

import { formatNumber } from "@/application/clicker-display"
import { ClickerRebirthWorldlineSelect } from "@/components/clicker/clicker-rebirth-worldline-select"
import type { MetaState, TranscendenceDef } from "@/domain/entities/clicker"
import type { PanelProps } from "./types"

export function ClickerTranscendencePanel({ game, run, meta, popIcons, bumpIcon, onSelectTab, onChoose }: PanelProps & {
  meta: MetaState
  onSelectTab: (tab: "producers" | "world") => void
  onChoose: (buff: TranscendenceDef) => void
}) {
  const transcendenceUnlocked = Boolean(game.hud?.canRebirth)
  const rebirthRatio = Math.min(1, run.lifetimeCoreEnergy / (game.hud?.rebirthRequirement ?? game.config.rebirthEnergy))
  const transcendenceOwned = new Set(meta.transcendenceIds).size
  const transcendenceTotal = game.config.transcendence.length
  const allWalked = transcendenceOwned >= transcendenceTotal
  const requirement = game.hud?.rebirthRequirement ?? game.config.rebirthEnergy
  return (
    <div className="clicker-transcendence">
      <header className="clicker-transcendence-head">
        <div className="clicker-transcendence-head-row">
          <p className="clicker-transcendence-kicker">WORLD LINE · 초월</p>
          <button
            type="button"
            className="clicker-ghost clicker-transcendence-back"
            aria-keyshortcuts="Escape"
            onClick={() => onSelectTab("producers")}
          >
            ← 돌아가기
          </button>
        </div>
        <h3>{transcendenceUnlocked ? "환생할 세계선을 고르세요" : allWalked ? "다섯 세계선 완료" : "환생 준비 중"}</h3>
        <div
          className="clicker-transcendence-meter"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(rebirthRatio * 100)}
          aria-label="환생 진행"
        >
          <div className="clicker-bar">
            <i style={{ width: `${Math.round(rebirthRatio * 100)}%` }} />
          </div>
          <span className="clicker-transcendence-meter-pct">
            {formatNumber(run.lifetimeCoreEnergy)} / {formatNumber(requirement)}
          </span>
        </div>
        <p className="clicker-transcendence-momentum">
          환생 보너스 · 채굴·생산 <strong>×{formatMultiplier(game.hud?.worldlineMultiplier ?? 1)}</strong> → 다음{" "}
          <strong>×{formatMultiplier((game.hud?.worldlineMultiplier ?? 1) * (1 + game.config.worldlineBonus))}</strong>
        </p>
        <p className="clicker-transcendence-progress">
          세계선 <strong>{transcendenceOwned}/{transcendenceTotal}</strong>
          {allWalked ? " · Core Heart로 가세요" : ""}
        </p>
      </header>
      {transcendenceUnlocked ? (
        <>
          <ClickerRebirthWorldlineSelect
            buffs={game.config.transcendence}
            ownedIds={meta.transcendenceIds}
            popIcons={popIcons}
            onChoose={(buff) => {
              bumpIcon(buff.id)
              onChoose(buff)
            }}
          />
        </>
      ) : (
        <div className="clicker-transcendence-locked" role="status">
          <div className="clicker-transcendence-locked-actions">
            <button type="button" className="clicker-primary" onClick={() => onSelectTab("producers")}>
              돌아가기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function formatMultiplier(n: number): string {
  return n >= 100 ? formatNumber(n) : n.toFixed(n >= 10 ? 1 : 2).replace(/\.?0+$/, "")
}
