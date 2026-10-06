"use client"

import { useEffect, useRef, useState } from "react"
import { CLICKER_ASSETS } from "@/data/clicker/catalog"
import { CLICKER_COMPLETION_EPILOGUE } from "@/data/clicker/ending"
import { clickerReadCompletionRecords } from "@/application/clicker"
import {
  clickerCompletionRank,
  clickerPlayTimeMs,
  formatClickerPlayTime,
  formatNumber,
  sortClickerCompletionRecords,
  type ClickerCompletionRecord,
  type MetaState,
} from "@/application/clicker-ui"
import { useArmedPress, useClickerDialogFocus, useFocusOnChange } from "@/components/clicker/clicker-a11y"
import { ClickerRanking } from "@/components/clicker/clicker-ranking"

type Props = {
  meta: MetaState
  worldlineTotal: number
  /** Full wipe — prod-safe completion restart (not an admin cheat). */
  onReset: () => void
  signedIn?: boolean
  /** Upload the sealed run so the online ranking sees the clear. */
  pushNow?: () => Promise<boolean>
}

export function ClickerComplete({ meta, worldlineTotal, onReset, signedIn = false, pushNow }: Props) {
  const [confirmReset, setConfirmReset] = useState(false)
  const [rankingKey, setRankingKey] = useState(0)
  const [localRecords, setLocalRecords] = useState<{ available: boolean; records: ClickerCompletionRecord[] } | null>(null)
  const rootRef = useRef<HTMLElement | null>(null)
  const startRef = useRef<HTMLButtonElement | null>(null)
  const cancelRef = useRef<HTMLButtonElement | null>(null)
  const completedDate =
    meta.completedAt != null ? new Date(meta.completedAt).toLocaleString("ko-KR") : "—"
  const worldlinesOwned = meta.transcendenceIds.length
  const playTimeMs = clickerPlayTimeMs(meta)
  const completionRank =
    localRecords?.available && meta.completedAt != null
      ? clickerCompletionRank(localRecords.records, meta.completedAt)
      : null
  const topRecords = localRecords?.available ? sortClickerCompletionRecords(localRecords.records).slice(0, 5) : []

  useClickerDialogFocus(rootRef)
  // "삭제하고 새 기록" appears where "새 기록 시작" was; a double-click must not wipe the save.
  const armedPress = useArmedPress(confirmReset)
  useFocusOnChange(confirmReset ? cancelRef : startRef, confirmReset)

  useEffect(() => {
    const readRecords = () => setLocalRecords(clickerReadCompletionRecords())
    const timer = window.setTimeout(readRecords, 0)
    window.addEventListener("storage", readRecords)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("storage", readRecords)
    }
  }, [])

  // The sealed run goes to the cloud first; the ranking refetches once it has landed.
  useEffect(() => {
    if (!signedIn || !pushNow) return
    let alive = true
    void pushNow().then((ok) => alive && ok && setRankingKey((k) => k + 1))
    return () => {
      alive = false
    }
  }, [signedIn, pushNow])

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
        style={{ backgroundImage: `url(/clicker/ending/ending_dawn.webp), url(${CLICKER_ASSETS.bgTranscendence})` }}
        aria-hidden
      />
      <article
        ref={rootRef}
        className="clicker-complete-card"
        role="dialog"
        aria-labelledby="clicker-complete-title"
      >
        <div className="clicker-complete-sigil" aria-hidden="true">
          <span>✦</span>
        </div>
        <p className="clicker-complete-kicker">AURELIA · FINAL WORLDLINE</p>
        <h1 id="clicker-complete-title">새벽을 열었습니다</h1>
        <p className="clicker-complete-epilogue">{CLICKER_COMPLETION_EPILOGUE}</p>
        <dl className="clicker-complete-stats">
          <div className="is-highlight">
            <dt>플레이 시간</dt>
            <dd>{playTimeMs === null ? "기록 없음" : formatClickerPlayTime(playTimeMs)}</dd>
          </div>
          <div className="is-highlight">
            <dt>이 기기 순위</dt>
            <dd>{completionRank === null ? "—" : `${completionRank}위`}</dd>
          </div>
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
        <ClickerRanking signedIn={signedIn} refreshKey={rankingKey} worldlineTotal={worldlineTotal} />
        <section className="clicker-complete-leaderboard" aria-labelledby="clicker-complete-leaderboard-title">
          <div className="clicker-complete-leaderboard-head">
            <div>
              <p className="clicker-complete-leaderboard-kicker">LOCAL HALL OF FAME</p>
              <h2 id="clicker-complete-leaderboard-title">최단 클리어 기록</h2>
            </div>
            <span>TOP 5</span>
          </div>
          {localRecords === null ? (
            <p className="clicker-complete-leaderboard-empty">기록을 불러오는 중…</p>
          ) : !localRecords.available ? (
            <p className="clicker-complete-leaderboard-empty">
              이 기기의 로컬 기록을 읽지 못해 순위를 표시할 수 없습니다.
            </p>
          ) : topRecords.length === 0 ? (
            <p className="clicker-complete-leaderboard-empty">아직 저장된 완료 기록이 없습니다.</p>
          ) : (
            <ol className="clicker-complete-leaderboard-list">
              {topRecords.map((record, index) => (
                <li
                  key={record.completedAt}
                  className={record.completedAt === meta.completedAt ? "is-current" : ""}
                  aria-current={record.completedAt === meta.completedAt ? "true" : undefined}
                >
                  <span className="clicker-complete-rank">{String(index + 1).padStart(2, "0")}</span>
                  <span className="clicker-complete-record-copy">
                    <strong>{formatClickerPlayTime(record.playTimeMs)}</strong>
                    <small>
                      세계선 {record.worldlinesOwned}/{worldlineTotal} · 환생 {record.rebirthCount}
                    </small>
                  </span>
                  {record.completedAt === meta.completedAt ? (
                    <span className="clicker-complete-record-tag">이번 기록</span>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
          <p className="clicker-complete-leaderboard-foot">
            이 순위는 이 브라우저에 저장된 완료 기록만 비교합니다. 전역 온라인 순위가 아닙니다.
          </p>
          {localRecords?.available && playTimeMs !== null && completionRank === null ? (
            <p className="clicker-complete-leaderboard-status">
              이번 완료 기록을 로컬 순위에 저장하지 못했습니다.
            </p>
          ) : null}
          {playTimeMs === null ? (
            <p className="clicker-complete-leaderboard-status">
              기존 저장에는 시작 시각이 없어 플레이 시간과 순위를 계산할 수 없습니다.
            </p>
          ) : null}
        </section>
        <p className="clicker-complete-note">
          이 세계선은 닫혔습니다. 채굴을 이어갈 수는 없습니다. 새 기록을 시작하면 세이브가 처음부터 다시 쓰입니다.
        </p>
        {!confirmReset ? (
          <div className="clicker-complete-actions">
            <button ref={startRef} type="button" className="clicker-primary" onClick={() => setConfirmReset(true)}>
              새 기록 시작
            </button>
          </div>
        ) : (
          <div className="clicker-complete-confirm" role="group" aria-label="새 기록 확인">
            <p>현재 기록·세이브가 삭제됩니다. 되돌릴 수 없습니다. (8초 후 또는 Esc로 취소)</p>
            <div className="clicker-complete-actions">
              <button ref={cancelRef} type="button" className="clicker-ghost" onClick={() => setConfirmReset(false)}>
                취소 · Esc
              </button>
              <button
                type="button"
                className="clicker-danger"
                aria-label="세이브를 삭제하고 새 기록을 시작합니다"
                onClick={armedPress(onReset)}
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
