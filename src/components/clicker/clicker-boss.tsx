"use client"

import { useEffect, useRef, useState } from "react"
import type { BossDef, BossFight } from "@/application/clicker-ui"
import { formatNumber } from "@/application/clicker-ui"
import { playSfx } from "@/lib/clicker-sfx"
import { MonsterArt } from "@/components/clicker/clicker-monster"
import { ClickerHpBar } from "@/components/clicker/clicker-hpbar"
import "./clicker-monster.css"

type Props = {
  def: BossDef
  fight: BossFight | null
  now: number
  defeated: boolean
  onStart: () => void
  onStrike: (clientX: number, clientY: number) => void
}

/** Core Heart: tap the guardian to hurt it before its blows or the clock end the fight. */
export function ClickerBossFight({ def, fight, now, defeated, onStart, onStrike }: Props) {
  const [attack, setAttack] = useState(0)
  const [lost, setLost] = useState(false)
  const [hit, setHit] = useState(0)
  const prev = useRef(fight)

  useEffect(() => {
    const before = prev.current
    prev.current = fight
    if (before && fight && fight.playerHp < before.playerHp) {
      setAttack((n) => n + 1)
      playSfx("playerHurt")
    }
    if (before && !fight && !defeated) setLost(true)
    if (fight) setLost(false)
  }, [fight, defeated])

  const left = fight ? Math.max(0, fight.endsAt - now) / 1000 : def.timeLimitSec
  return (
    <div className={`clicker-boss${attack ? " is-attack" : ""}${def.imageSrc ? " has-art" : ""}${fight ? " is-fighting" : ""}`}>
      {fight ? null : <strong>{def.name}</strong>}
      {fight ? (
        <div className="clicker-boss-bars">
          <ClickerHpBar
            tone="boss"
            value={fight.hp}
            max={fight.maxHp}
            label={def.name}
            valueText={`${formatNumber(Math.max(0, fight.hp))} / ${formatNumber(fight.maxHp)}`}
            ariaLabel="수호자 체력"
          />
          <ClickerHpBar
            tone="player"
            value={fight.playerHp}
            max={fight.playerMaxHp}
            label="내 체력"
            valueText={`${Math.max(0, fight.playerHp)} / ${fight.playerMaxHp} · ${left.toFixed(1)}초`}
            ariaLabel="내 체력"
          />
        </div>
      ) : null}
      <button
        type="button"
        data-sfx="off"
        className="clicker-boss-target"
        aria-label={fight ? `${def.name} 공격` : `${def.name}`}
        disabled={!fight}
        onPointerDown={(e) => {
          if (!fight || e.button !== 0) return
          e.preventDefault()
          setHit((n) => n + 1)
          onStrike(e.clientX, e.clientY)
        }}
      >
        {def.imageSrc ? (
          // Only the art re-mounts to replay the lunge; re-mounting the whole fight swallowed taps.
          <span className="boss-art-enter" key={attack}>
            <span className="boss-art-idle">
              <span className={`boss-art-hit${hit ? ` hit-${hit % 2}` : ""}`}>
                <span className="boss-art-canvas">
                  <img className="boss-art-img" src={def.imageSrc} alt="" draggable={false} />
                </span>
                <span className="boss-art-core" aria-hidden />
                <span className="boss-art-eyes" aria-hidden />
              </span>
            </span>
          </span>
        ) : (
          <MonsterArt kind={def.kind} />
        )}
      </button>
      {!fight ? (
        <>
          {lost ? <p className="clicker-boss-note">쓰러졌습니다. 더 강해져서 다시 도전하세요.</p> : null}
          <button type="button" className="clicker-danger clicker-boss-start" onClick={onStart}>
            {defeated ? "다시 싸우기" : "수호자에게 도전"} · {def.timeLimitSec}초
          </button>
        </>
      ) : null}
      {attack && fight ? <div className="clicker-boss-hurt" key={`hurt-${attack}`} aria-hidden /> : null}
      <span className="clicker-boss-dread" aria-hidden />
    </div>
  )
}
