"use client"

import { useRef, useState, type CSSProperties, type PointerEvent } from "react"
import { guardianArt } from "@/data/clicker/monsters"
import { formatNumber } from "@/domain/services/clicker-format"
import { GUARDIAN_RESPAWN_MS } from "@/domain/services/clicker-hunt"
import "./clicker-guardian.css"

export type GuardianView = {
  regionId: string
  name: string
  nameEn: string
  epithet: string
  level: number
  hp: number
  maxHp: number
  respawnInMs: number
}

type Props = {
  guardian: GuardianView
  /** One tap; returns whether it landed and whether it was the killing blow. */
  onHit: (clientX: number, clientY: number) => { killed: boolean; critical: boolean } | null
}

/** Scene art is 1680×944. */
const SCENE_RATIO = 1680 / 944

/**
 * The region's guardian on the home screen. Tap its body to fight it: each tap is a
 * mining click dealt as damage; at zero HP it falls and a tougher one revives 30s later.
 */
export function ClickerGuardian({ guardian, onHit }: Props) {
  const art = guardianArt(guardian.regionId)
  const down = guardian.hp <= 0
  // Replays the arrival animation each time a new guardian stands up.
  const spawnKey = `${guardian.regionId}-${guardian.level}-${down ? "down" : "up"}`
  // Hits count per guardian, so a fresh one starts with its arrival animation.
  const [hits, setHits] = useState({ key: spawnKey, seq: 0, crit: false })
  const hitSeq = hits.key === spawnKey ? hits.seq : 0
  const crit = hits.crit
  const lastTap = useRef(0)
  const landed = (critical: boolean) =>
    setHits((h) => ({ key: spawnKey, seq: (h.key === spawnKey ? h.seq : 0) + 1, crit: critical }))

  if (!art) return null
  // While down the bar refills toward the revival instead of showing HP.
  const ratio = down
    ? 1 - Math.min(1, guardian.respawnInMs / GUARDIAN_RESPAWN_MS)
    : guardian.maxHp > 0
      ? Math.max(0, Math.min(1, guardian.hp / guardian.maxHp))
      : 0

  const strike = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return
    // Touch fires pointerdown once per finger; ignore sub-frame duplicates.
    if (e.timeStamp - lastTap.current < 16) return
    lastTap.current = e.timeStamp
    const result = onHit(e.clientX, e.clientY)
    if (result) landed(result.critical)
  }

  // Circle over the body: x/r are % of the art's width, y of its height.
  const bodyStyle: CSSProperties = {
    left: `${art.body.x - art.body.r}%`,
    top: `${art.body.y}%`,
    width: `${art.body.r * 2}%`,
  }

  return (
    <div
      className={`clicker-guardian is-${art.kind}${down ? " is-down" : ""}`}
      style={
        {
          "--accent": art.accent,
          "--fx": art.focus.x / 100,
          "--fy": art.focus.y / 100,
          "--ratio": SCENE_RATIO,
        } as CSSProperties
      }
    >
      <div className="clicker-guardian-scene">
        <div
          key={`${spawnKey}-${hitSeq}`}
          className={`clicker-guardian-art${hitSeq > 0 ? (crit ? " is-crit" : " is-hit") : down ? "" : " is-arrive"}`}
        >
          <img src={art.src} alt="" draggable={false} />
        </div>
        {!down ? (
          <button
            type="button"
            className="clicker-guardian-hit"
            style={art.kind === "scene" ? bodyStyle : undefined}
            aria-label={`${guardian.name} 공격 · 체력 ${formatNumber(guardian.hp)} / ${formatNumber(guardian.maxHp)}`}
            onPointerDown={strike}
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== " ") return
              e.preventDefault()
              const r = e.currentTarget.getBoundingClientRect()
              const result = onHit(r.left + r.width / 2, r.top + r.height / 2)
              if (result) landed(result.critical)
            }}
          />
        ) : null}
      </div>

      <div className="clicker-guardian-hud" role="status" aria-live="off">
        <div className="clicker-guardian-title">
          <strong>{guardian.name}</strong>
          <span>
            {guardian.nameEn} · Lv.{guardian.level + 1}
          </span>
        </div>
        <div className={`clicker-guardian-hp${down ? " is-respawn" : ""}`} aria-hidden>
          <i key={down ? "respawn" : "hp"} style={{ width: `${ratio * 100}%` }} />
        </div>
        <div className="clicker-guardian-meta">
          {down ? (
            <>
              <span className="is-down">처치 완료 · Lv.{guardian.level + 1} 수호자 부활 대기</span>
              <span className="is-hp">{Math.ceil(guardian.respawnInMs / 1000)}초</span>
            </>
          ) : (
            <>
              <span>{guardian.epithet}</span>
              <span className="is-hp">
                {formatNumber(guardian.hp)} / {formatNumber(guardian.maxHp)}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
