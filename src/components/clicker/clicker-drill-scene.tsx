"use client"

import type { CSSProperties, PointerEvent } from "react"
import { drillMotes } from "@/application/clicker-stage"
import { playDrillStrike } from "@/lib/clicker-sfx"

type Props = {
  hits: number
  cooling: boolean
  gauge: number
  coolSec: number
  disabled: boolean
  onVein: (x: number, y: number) => number | null
  onAccepted: (paid: number) => void
}

/** The hanging rig, its floor contact, and the strike particles. The vein payout stays with the caller. */
export function ClickerDrillScene({ hits, cooling, gauge, coolSec, disabled, onVein, onAccepted }: Props) {
  const motes = drillMotes()
  return (
    <div className="clicker-drill-scene">
      <button
        type="button"
        data-sfx="off"
        key={hits}
        className={`clicker-drill${hits ? " is-hit" : ""}${cooling ? " is-cooling" : ""}`}
        disabled={disabled || cooling}
        aria-label={coolSec > 0 ? `시추 장비 냉각 중 ${coolSec}초` : `코어 에너지 시추 · 게이지 ${Math.round(gauge * 100)}%`}
        onPointerDown={(e: PointerEvent<HTMLButtonElement>) => {
          if (e.button !== 0) return
          e.preventDefault()
          const paid = onVein(e.clientX, e.clientY)
          if (paid === null) return
          playDrillStrike(paid > 0)
          onAccepted(paid)
        }}
      >
        <img src="/clicker/drill/drill_hanging_v1.webp" className="clicker-drill-rig" alt="" draggable={false} />
        <span className="clicker-drill-glow" aria-hidden />
        <span className="clicker-drill-ring" aria-hidden />
        <span className="clicker-drill-motes" aria-hidden>
          {motes.map((mote, i) => (
            <i key={i} style={{ ["--i" as string]: i, left: mote.left, animationDelay: mote.delay } as CSSProperties} />
          ))}
        </span>
        {hits ? (
          <>
            <span className="clicker-drill-gush" aria-hidden />
            <span className="clicker-drill-shock" aria-hidden />
            <span className="clicker-drill-debris" aria-hidden>
              {Array.from({ length: 10 }, (_, i) => (
                <i key={i} style={{ ["--i" as string]: i } as CSSProperties} />
              ))}
            </span>
          </>
        ) : null}
      </button>
    </div>
  )
}
