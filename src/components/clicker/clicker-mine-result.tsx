"use client"

import { useEffect, useRef, useState } from "react"
import { formatNumber } from "@/domain/services/clicker-format"
import type { MineSessionSummary } from "@/domain/services/clicker-mine-session"
import { useClickerDialogFocus, useClickerEscape } from "@/components/clicker/clicker-a11y"

type Props = {
  summary: MineSessionSummary
  /** Seconds until Enter Mine opens again. */
  cooldownSec: number
  onClose: () => void
}

const TALLY_MS = 750

/** Counts the haul up from 0 so the payout lands; reduced motion shows it at once. */
function useTally(target: number): { value: number; done: boolean } {
  const [value, setValue] = useState(0)
  const [done, setDone] = useState(false)
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const duration = reduce || target <= 0 ? 0 : TALLY_MS
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = duration > 0 ? Math.min(1, (now - start) / duration) : 1
      setValue(target * (1 - (1 - p) ** 3))
      if (p < 1) raf = window.requestAnimationFrame(tick)
      else setDone(true)
    }
    raf = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(raf)
  }, [target])
  return { value, done }
}

/** Timed mine session result card: haul, strikes, ores, veins and the best-haul record. */
export function ClickerMineResult({ summary, cooldownSec, onClose }: Props) {
  const ref = useRef<HTMLDivElement | null>(null)
  useClickerDialogFocus(ref, true)
  useClickerEscape(true, onClose)
  const tally = useTally(summary.haul)
  const critRate = summary.strikes > 0 ? Math.round((summary.crits / summary.strikes) * 100) : 0
  return (
    <div className="clicker-welcome-scrim" onClick={onClose}>
      <div
        ref={ref}
        className={`clicker-welcome clicker-mine-result${summary.best ? " is-best" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="clicker-mine-result-title"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="clicker-welcome-kicker">MINE SESSION · {summary.seconds}s</p>
        <h2 id="clicker-mine-result-title">{summary.best ? "최고 기록 갱신!" : "채굴 종료"}</h2>
        <p
          className={`clicker-welcome-amount${tally.done ? " is-landed" : ""}`}
          aria-label={`+${formatNumber(summary.haul)} CORE`}
        >
          <b className="clicker-welcome-amount-value" aria-hidden>+{formatNumber(tally.value)}</b>{" "}
          <span aria-hidden>CORE</span>
        </p>
        {summary.best && summary.previousBest > 0 ? (
          <p className="clicker-welcome-note">이전 최고 {formatNumber(summary.previousBest)}</p>
        ) : !summary.best && summary.previousBest > 0 ? (
          <p className="clicker-welcome-note">최고 기록 {formatNumber(summary.previousBest)}</p>
        ) : null}
        {summary.strikes > 0 || summary.veins > 0 ? (
          <dl className="clicker-mine-result-stats">
            <div>
              <dt>타격</dt>
              <dd>{formatNumber(summary.strikes)}</dd>
            </div>
            <div>
              <dt>치명타</dt>
              <dd>{critRate}%</dd>
            </div>
            <div>
              <dt>황금 광맥</dt>
              <dd>{summary.veins}</dd>
            </div>
          </dl>
        ) : null}
        <div className="clicker-welcome-actions">
          <button type="button" className="clicker-primary" onClick={onClose}>
            확인
          </button>
        </div>
        <p className="clicker-welcome-hint">
          {cooldownSec > 0 ? `${cooldownSec}초 뒤 다시 입장할 수 있습니다.` : "지금 다시 입장할 수 있습니다."}
        </p>
      </div>
    </div>
  )
}
