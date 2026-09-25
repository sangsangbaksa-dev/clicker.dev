"use client"

import { CLICKER_ASSETS } from "@/data/clicker/catalog"
import { formatNumber } from "@/domain/services/clicker-format"
import { ClickerRebirthWorldlineSelect } from "@/components/clicker/clicker-rebirth-worldline-select"
import type { MetaState, TranscendenceDef } from "@/domain/entities/clicker"
import type { PanelProps } from "./types"

export function ClickerTranscendencePanel({ game, run, meta, popIcons, bumpIcon, onSelectTab, onOpenEnding, onChoose }: PanelProps & {
  meta: MetaState
  onSelectTab: (tab: "producers" | "world") => void
  onOpenEnding: () => void
  onChoose: (buff: TranscendenceDef) => void
}) {
  const transcendenceUnlocked = Boolean(game.hud?.canRebirth)
  const rebirthRatio = Math.min(1, run.lifetimeCoreEnergy / (game.hud?.rebirthRequirement ?? game.config.rebirthEnergy))
  const transcendenceOwned = new Set(meta.transcendenceIds).size
  const transcendenceTotal = game.config.transcendence.length
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
            ← 돌아가기 · Esc
          </button>
        </div>
        <h3>{transcendenceUnlocked ? "세계선을 접고 하나를 선택하세요" : "세계선 접기 · 접근 중"}</h3>
        {transcendenceUnlocked ? (
          <p className="clicker-transcendence-lead">
            누적 CORE {formatNumber((game.hud?.rebirthRequirement ?? game.config.rebirthEnergy))} 도달. 아래에서 선을 고르면 재탄생이 시작됩니다. 버프는
            영구 · 이번 런의 생산·채굴은 초기화됩니다.
          </p>
        ) : (
          <p className="clicker-transcendence-lead">
            누적 CORE{" "}
            <strong className="clicker-transcendence-lead-num">
              {formatNumber(run.lifetimeCoreEnergy)}
            </strong>{" "}
            / {formatNumber((game.hud?.rebirthRequirement ?? game.config.rebirthEnergy))}. 남은{" "}
            <strong className="clicker-transcendence-lead-num">
              {formatNumber(Math.max(0, (game.hud?.rebirthRequirement ?? game.config.rebirthEnergy) - run.lifetimeCoreEnergy))}
            </strong>
            이면 임계에 닿습니다.
          </p>
        )}
        <div
          className="clicker-transcendence-meter"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(rebirthRatio * 100)}
          aria-label="초월 진행"
        >
          <div className="clicker-bar">
            <i style={{ width: `${Math.round(rebirthRatio * 100)}%` }} />
          </div>
          <span className="clicker-transcendence-meter-pct">{Math.round(rebirthRatio * 100)}%</span>
        </div>
        <p className="clicker-transcendence-meter-caption">
          {transcendenceUnlocked
            ? "임계 도달 · 선택 가능"
            : `임계까지 ${formatNumber(Math.max(0, (game.hud?.rebirthRequirement ?? game.config.rebirthEnergy) - run.lifetimeCoreEnergy))} CORE`}
        </p>
        {(() => {
          const now = game.hud?.worldlineMultiplier ?? 1
          const next = now * (1 + game.config.worldlineBonus)
          return (
            <p className="clicker-transcendence-momentum">
              세계선 가속 · 클릭·생산 <strong>×{formatMultiplier(now)}</strong> → 다음 세계선{" "}
              <strong>×{formatMultiplier(next)}</strong> (영구 · 환생할수록 더 빨라집니다)
            </p>
          )
        })()}
        <p className="clicker-transcendence-progress">
          거친 세계선 <strong>{transcendenceOwned}/{transcendenceTotal}</strong>
          {game.canCompleteEnding
            ? " · AURELIA Protocol 대기 중"
            : transcendenceUnlocked
              ? " · 모든 세계선을 거치면 Protocol이 열립니다"
              : " · 선택 UI는 임계 이후 공개"}
        </p>
      </header>
      {/* All five worldlines walked: the Protocol opens without waiting for the next fold. */}
      {game.canCompleteEnding ? (
        <article className="clicker-card clicker-protocol-card">
          <img src={CLICKER_ASSETS.icon} alt="" />
          <div>
            <strong>AURELIA Protocol</strong>
            <p className="clicker-protocol-copy">
              다섯 세계선의 기억이 하나로 수렴했습니다. 실행하면 이 기록은 닫힙니다.
            </p>
          </div>
          <button
            className="clicker-danger"
            type="button"
            aria-label="AURELIA Protocol 열기 — 기록 종료 확인"
            onClick={onOpenEnding}
          >
            Protocol 열기
          </button>
        </article>
      ) : null}
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
      ) : game.canCompleteEnding ? null : (
        <div className="clicker-transcendence-locked" role="status">
          <p>
            임계 전에는 초월의 방을 열지 않습니다. 광산에서 CORE를 더 채굴한 뒤, 상단 TRANSCENDENCE 또는 이
            탭으로 돌아오세요.
          </p>
          <div className="clicker-transcendence-locked-actions">
            <button type="button" className="clicker-primary" onClick={() => onSelectTab("producers")}>
              광산에서 채굴 계속
            </button>
            <button type="button" className="clicker-ghost" onClick={() => onSelectTab("world")}>
              WORLD에서 지역 확인
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
