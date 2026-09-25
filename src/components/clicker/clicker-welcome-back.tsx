"use client"

import { useRef } from "react"
import { formatNumber } from "@/domain/services/clicker-format"
import type { OfflineSummary } from "@/hooks/use-clicker"
import { useClickerDialogFocus, useClickerEscape } from "@/components/clicker/clicker-a11y"

type Props = {
  summary: OfflineSummary
  doubleWindowSec: number
  onClaim: () => void
  onEnterMine: () => void
}

function formatAway(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return m > 0 ? `${h}시간 ${m}분` : `${h}시간`
  if (m > 0) return `${m}분`
  return `${Math.max(1, Math.round(seconds))}초`
}

/** Welcome-back panel: shows the offline grant and offers ×2 for entering the mine soon. */
export function ClickerWelcomeBack({ summary, doubleWindowSec, onClaim, onEnterMine }: Props) {
  const ref = useRef<HTMLDivElement | null>(null)
  useClickerDialogFocus(ref, true)
  useClickerEscape(true, onClaim)
  return (
    <div className="clicker-welcome-scrim">
      <div
        ref={ref}
        className="clicker-welcome"
        role="dialog"
        aria-modal="true"
        aria-labelledby="clicker-welcome-title"
      >
        <p className="clicker-welcome-kicker">WELCOME BACK</p>
        <h2 id="clicker-welcome-title">자리를 비운 {formatAway(summary.seconds)} 동안</h2>
        <p className="clicker-welcome-amount">
          +{formatNumber(summary.gained)} <span>CORE</span>
        </p>
        {summary.capped ? <p className="clicker-welcome-note">최대 8시간까지만 쌓입니다.</p> : null}
        <div className="clicker-welcome-actions">
          <button type="button" className="clicker-primary" onClick={onEnterMine}>
            광산 입장 · 보상 2배
          </button>
          <button type="button" className="clicker-ghost" onClick={onClaim}>
            받기
          </button>
        </div>
        <p className="clicker-welcome-hint">{doubleWindowSec}초 안에 광산에 들어가면 같은 양을 한 번 더 받습니다.</p>
      </div>
    </div>
  )
}
