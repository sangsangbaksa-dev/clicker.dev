"use client"

import { useEffect, useRef, useState } from "react"
import { CLICKER_ASSETS } from "@/data/clicker/catalog"
import { CLICKER_COMPLETION_EPILOGUE } from "@/data/clicker/ending"
import { formatNumber } from "@/domain/services/clicker-format"
import type { MetaState } from "@/domain/entities/clicker"
import { useClickerDialogFocus } from "@/components/clicker/clicker-a11y"

type Props = {
  meta: MetaState
  worldlineTotal: number
  /** Full wipe — prod-safe completion restart (not an admin cheat). */
  onReset: () => void
}

export function ClickerComplete({ meta, worldlineTotal, onReset }: Props) {
  const [confirmReset, setConfirmReset] = useState(false)
  const rootRef = useRef<HTMLElement | null>(null)
  const completedDate =
    meta.completedAt != null ? new Date(meta.completedAt).toLocaleString("ko-KR") : "—"
  const worldlinesOwned = meta.transcendenceIds.length

  useClickerDialogFocus(rootRef)

  useEffect(() => {
    if (!confirmReset) return
    const timer = window.setTimeout(() => setConfirmReset(false), 8000)
    return () => window.clearTimeout(timer)
  }, [confirmReset])

  useEffect(() => {
    if (!confirmReset) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return
      e.preventDefault()
      setConfirmReset(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [confirmReset])

  return (
    <div data-clicker className="clicker-shell clicker-complete">
      <div
        className="clicker-complete-bg"
        style={{ backgroundImage: `url(${CLICKER_ASSETS.bgTranscendence})` }}
        aria-hidden
      />
      <article
        ref={rootRef}
        className="clicker-complete-card"
        role="dialog"
        aria-labelledby="clicker-complete-title"
      >
        <p className="clicker-complete-kicker">AURELIA · 세계선 종료</p>
        <h1 id="clicker-complete-title">기록 완료</h1>
        <p className="clicker-complete-epilogue">{CLICKER_COMPLETION_EPILOGUE}</p>
        <dl className="clicker-complete-stats">
          <div>
            <dt>세계선</dt>
            <dd>
              {worldlinesOwned}/{worldlineTotal}
            </dd>
          </div>
          <div>
            <dt>환생</dt>
            <dd>{meta.rebirthCount}</dd>
          </div>
          <div>
            <dt>누적 CORE</dt>
            <dd>{formatNumber(meta.totalCoreEnergy)}</dd>
          </div>
          <div>
            <dt>채굴</dt>
            <dd>{formatNumber(meta.statistics.clicks)}</dd>
          </div>
          <div className="is-wide">
            <dt>완료 시각</dt>
            <dd>{completedDate}</dd>
          </div>
        </dl>
        <p className="clicker-complete-note">
          이 세계선은 닫혔습니다. 채굴을 이어갈 수는 없습니다. 새 기록을 시작하면 세이브가 처음부터 다시 쓰입니다.
        </p>
        {!confirmReset ? (
          <div className="clicker-complete-actions">
            <button type="button" className="clicker-primary" onClick={() => setConfirmReset(true)}>
              새 기록 시작
            </button>
          </div>
        ) : (
          <div className="clicker-complete-confirm" role="group" aria-label="새 기록 확인">
            <p>현재 기록·세이브가 삭제됩니다. 되돌릴 수 없습니다. (8초 후 또는 Esc로 취소)</p>
            <div className="clicker-complete-actions">
              <button type="button" className="clicker-ghost" onClick={() => setConfirmReset(false)}>
                취소<span className="clicker-key-hint"> · Esc</span>
              </button>
              <button
                type="button"
                className="clicker-danger"
                aria-label="세이브를 삭제하고 새 기록을 시작합니다"
                onClick={onReset}
              >
                삭제하고 새 기록
              </button>
            </div>
          </div>
        )}
      </article>
    </div>
  )
}
