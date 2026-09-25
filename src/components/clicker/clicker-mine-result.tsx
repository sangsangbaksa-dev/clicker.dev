"use client"

import { useRef } from "react"
import { formatNumber } from "@/domain/services/clicker-format"
import type { RegionActivity } from "@/domain/entities/clicker"
import type { MineSessionSummary } from "@/domain/services/clicker-mine-session"
import { useClickerDialogFocus, useClickerEscape } from "@/components/clicker/clicker-a11y"

type Props = {
  summary: MineSessionSummary
  /** Which region activity the session was; picks the headline and stats. */
  activity: RegionActivity
  /** Seconds until Enter Mine opens again. */
  cooldownSec: number
  onClose: () => void
}

const COPY: Record<RegionActivity, { kicker: string; done: string }> = {
  mine: { kicker: "MINE SESSION", done: "채굴 종료" },
  hunt: { kicker: "HUNT SESSION", done: "사냥 종료" },
  vault: { kicker: "VAULT SESSION", done: "금고 해제 종료" },
}

/** Timed session result card: haul, the activity's own stats, and the best-haul record. */
export function ClickerMineResult({ summary, activity, cooldownSec, onClose }: Props) {
  const ref = useRef<HTMLDivElement | null>(null)
  useClickerDialogFocus(ref, true)
  useClickerEscape(true, onClose)
  const critRate = summary.strikes > 0 ? Math.round((summary.crits / summary.strikes) * 100) : 0
  const stats: Array<[string, string | number]> =
    activity === "hunt"
      ? [
          ["타격", formatNumber(summary.strikes)],
          ["치명타", `${critRate}%`],
          ["처치", summary.monstersSlain],
        ]
      : activity === "vault"
        ? [
            ["해제 성공", summary.vaultLocks],
            ["치명타", `${critRate}%`],
          ]
        : [
            ["타격", formatNumber(summary.strikes)],
            ["치명타", `${critRate}%`],
            ["광석 파괴", summary.oresBroken],
            ["황금 광맥", summary.veins],
          ]
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
        <p className="clicker-welcome-kicker">
          {COPY[activity].kicker} · {summary.seconds}s
        </p>
        <h2 id="clicker-mine-result-title">{summary.best ? "최고 기록 갱신!" : COPY[activity].done}</h2>
        <p className="clicker-welcome-amount">
          +{formatNumber(summary.haul)} <span>CORE</span>
        </p>
        {summary.best && summary.previousBest > 0 ? (
          <p className="clicker-welcome-note">이전 최고 {formatNumber(summary.previousBest)}</p>
        ) : !summary.best && summary.previousBest > 0 ? (
          <p className="clicker-welcome-note">최고 기록 {formatNumber(summary.previousBest)}</p>
        ) : null}
        {summary.strikes > 0 ? (
          <dl className="clicker-mine-result-stats">
            {stats.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
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
