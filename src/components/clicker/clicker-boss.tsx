"use client"

import { useEffect, useRef, useState } from "react"
import type { BossDef, BossFight } from "@/application/clicker-ui"
import { formatNumber, playGameSfxOr } from "@/application/clicker-ui"
import { playSfx } from "@/lib/clicker-sfx"
import { MonsterArt } from "@/components/clicker/clicker-monster"
import { MonsterView } from "@/components/clicker/clicker-monster-view"
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
    // Phase change when the guardian drops under half health.
    if (before && fight && before.hp > before.maxHp / 2 && fight.hp <= fight.maxHp / 2) {
      playGameSfxOr("bossPhaseChange", () => playSfx("bossRoar"))
    }
    if (before && !fight && !defeated) setLost(true)
    if (fight) setLost(false)
  }, [fight, defeated])

  const left = fight ? Math.max(0, fight.endsAt - now) / 1000 : def.timeLimitSec
  return (
    <div className={`clicker-boss${attack ? " is-attack" : ""}${def.imageSrc ? " has-art" : ""}${def.keyArt ? " has-keyart" : ""}${fight ? " is-fighting" : ""}`} key={attack}>
      <strong>{def.name}</strong>
      {fight ? (
        <div className="clicker-boss-bars">
          <div className="clicker-boss-bar" role="progressbar" aria-label="수호자 체력" aria-valuenow={Math.round((fight.hp / fight.maxHp) * 100)}>
            <i style={{ width: `${(fight.hp / fight.maxHp) * 100}%` }} />
            <span>
              {formatNumber(fight.hp)} / {formatNumber(fight.maxHp)}
            </span>
          </div>
          <div className="clicker-boss-bar is-player" role="progressbar" aria-label="내 체력" aria-valuenow={fight.playerHp}>
            <i style={{ width: `${(fight.playerHp / fight.playerMaxHp) * 100}%` }} />
            <span>
              내 체력 {Math.max(0, fight.playerHp)} / {fight.playerMaxHp} · {left.toFixed(1)}초
            </span>
          </div>
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
        {def.keyArt ? (
          <MonsterView src={def.keyArt} hitKey={hit} className="boss-keyart" />
        ) : def.imageSrc ? (
          <span className="boss-art-enter">
            <span className="boss-art-idle">
              <span className={`boss-art-hit${hit ? ` hit-${hit % 2}` : ""}`}>
                <span className="boss-art-canvas">
                  <img className="boss-art-img" src={def.imageSrc} alt="" draggable={false} />
                </span>
                <span className="boss-art-core" aria-hidden />
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
    </div>
  )
}
