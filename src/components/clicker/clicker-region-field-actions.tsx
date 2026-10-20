"use client"

import type { RegionView } from "@/application/clicker-ui"

type Props = {
  region: RegionView
  crisisActive: boolean
  onActivity: () => void
  onChallengeStart: () => void
}

/** Region-only activity + field challenge CTAs (replaces Enter Mine away from home). */
export function ClickerRegionFieldActions({ region, crisisActive, onActivity, onChallengeStart }: Props) {
  const act = region.activity
  const ch = region.challenge
  if (!act && !ch) return null

  const activityReady = Boolean(act && act.readyInMs <= 0 && !crisisActive)
  const challengeReady = Boolean(ch && ch.readyInMs <= 0 && !crisisActive)

  return (
    <div className="clicker-region-field-actions">
      {act ? (
        <button
          type="button"
          className={`clicker-region-activity${act.activeMs > 0 ? " is-active" : ""}${activityReady ? " is-next" : ""}`}
          disabled={!activityReady}
          aria-label={
            activityReady
              ? `${act.name} 발동 — ${act.description}`
              : act.activeMs > 0
                ? `${act.name} 진행 중`
                : `${act.name} · 재사용 대기 ${Math.ceil(act.readyInMs / 1000)}초`
          }
          onClick={onActivity}
        >
          <strong>{act.name}</strong>
          <span>
            {act.activeMs > 0
              ? act.deposit > 0
                ? `예치 ${Math.ceil(act.activeMs / 1000)}초 · CORE 잠김`
                : `진행 중 · ${Math.ceil(act.activeMs / 1000)}초`
              : activityReady
                ? act.description
                : `재사용 ${Math.ceil(act.readyInMs / 1000)}초`}
          </span>
        </button>
      ) : null}
      {ch ? (
        <button
          type="button"
          className={`clicker-region-activity is-challenge${challengeReady ? " is-next" : ""}`}
          disabled={!challengeReady}
          aria-label={
            challengeReady
              ? `${ch.name} 시작 — ${ch.description}`
              : `${ch.name} · 재도전 ${Math.ceil(ch.readyInMs / 1000)}초`
          }
          onClick={onChallengeStart}
        >
          <strong>{ch.name}</strong>
          <span>{challengeReady ? ch.description : `재도전 ${Math.ceil(ch.readyInMs / 1000)}초`}</span>
        </button>
      ) : null}
    </div>
  )
}
