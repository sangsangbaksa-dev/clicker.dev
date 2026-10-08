"use client"

import "./clicker-hpbar.css"

type Props = {
  value: number
  max: number
  tone: "boss" | "player"
  /** Left caption (name or "내 체력"). */
  label?: string
  /** Right caption, e.g. "1.2K / 5K". */
  valueText?: string
  ariaLabel: string
}

/**
 * Framed health bar: metal rim, glossy fill with tick marks, and a pale damage trail that
 * catches up a beat after each hit. Pulses when it drops under a quarter.
 */
export function ClickerHpBar({ value, max, tone, label, valueText, ariaLabel }: Props) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div
      className={`clicker-hpbar is-${tone}${pct <= 25 ? " is-low" : ""}`}
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      {label || valueText ? (
        <div className="clicker-hpbar-head">
          <span className="clicker-hpbar-emblem" aria-hidden />
          {label ? <b>{label}</b> : null}
          {valueText ? <span>{valueText}</span> : null}
        </div>
      ) : null}
      <div className="clicker-hpbar-rim">
        <div className="clicker-hpbar-track">
          <i className="clicker-hpbar-trail" style={{ width: `${pct}%` }} />
          <i className="clicker-hpbar-fill" style={{ width: `${pct}%` }} />
          <i className="clicker-hpbar-ticks" aria-hidden />
        </div>
      </div>
    </div>
  )
}
