"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import type { BossDef, BossFight } from "@/application/clicker-ui"
import { formatNumber } from "@/application/clicker-ui"
import { awakenedGuardianLabel as clickerAwakenedLabel } from "@/application/clicker-ui"
import { guardianLayout } from "@/application/clicker-guardian-frame"
import { clickerCues, guardianAudioPlan, type GuardianAudioSnap } from "@/application/clicker-cues"
import { bossFightOutcome, enrageLevel } from "@/application/clicker-guardian-motion"
import { useGuardianStageMetrics } from "@/hooks/use-guardian-stage-metrics"
import { playSfx } from "@/lib/clicker-sfx"
import { MonsterArt } from "@/components/clicker/clicker-monster"
import { GuardianSprite } from "@/components/clicker/clicker-guardian-sprite"
import { ClickerHpBar } from "@/components/clicker/clicker-hpbar"
import "./clicker-monster.css"

const GUARDIAN_OVERLAYS = [".clicker-hub-dock"] as const

type Props = {
  def: BossDef
  fight: BossFight | null
  now: number
  defeated: boolean
  onStart: () => void
  onStrike: (clientX: number, clientY: number) => void
  /** 각성 수호자 rematch offer (새벽의 광산 only). */
  awakened?: { label: string; reward: number; onStart: () => void } | null
}

/** Core Heart: tap the guardian to hurt it before its blows or the clock end the fight. */
export function ClickerBossFight({ def, fight, now, defeated, onStart, onStrike, awakened = null }: Props) {
  const isAwakened = Boolean(fight?.awakened)
  const name = isAwakened ? clickerAwakenedLabel(fight?.awakenedDepth ?? 0) : def.name
  const [attack, setAttack] = useState(0)
  const [lost, setLost] = useState(false)
  const [hit, setHit] = useState(0)
  const [fallen, setFallen] = useState(0)
  const prev = useRef(fight)
  const wasDefeated = useRef(defeated)

  useEffect(() => {
    const before = prev.current
    prev.current = fight
    if (before && fight && fight.playerHp < before.playerHp) {
      setAttack((n) => n + 1)
      playSfx("playerHurt")
    }
    if (before && !fight && !defeated) setLost(true)
    if (fight) setLost(false)
    // The kill (first one flips `defeated`, later ones are told apart from a loss by the last snapshot): it collapses.
    if (before && !fight && ((defeated && !wasDefeated.current) || bossFightOutcome(before, now, def.attackDamage) === "won"))
      setFallen((n) => n + 1)
    wasDefeated.current = defeated
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reacts to the fight / defeat changing, not to every tick
  }, [fight, defeated])

  // Sound: guardian animation events (appear / idle / hit / lunge / enrage / defeat) -> cues, through the pure plan.
  const enrage = fight ? enrageLevel(fight.hp / fight.maxHp) : 0
  const fighting = Boolean(fight)
  const audioPrev = useRef<GuardianAudioSnap | null>(null)
  useEffect(() => {
    const next: GuardianAudioSnap = { fighting, hits: hit, attacks: attack, defeats: fallen, enrage }
    const plan = guardianAudioPlan(audioPrev.current, next)
    audioPrev.current = next
    const cues = clickerCues()
    for (const id of plan.play) cues.play(id)
    if (plan.breath === "start") cues.startLoop("bossBreathLoop")
    else if (plan.breath === "stop") cues.stopLoop("bossBreathLoop")
  }, [fighting, hit, attack, fallen, enrage])
  useEffect(
    () => () => {
      audioPrev.current = null // a remount (strict mode) re-reads the fight instead of staying silent
      clickerCues().stopLoop("bossBreathLoop")
    },
    [],
  )

  // Painted guardian: it gets the stage's safe area (clear of the dock) as its column, and stands
  // on a ground line inside it, as large as fits between the name / HP bars and the button row.
  const rootRef = useRef<HTMLDivElement>(null)
  const metrics = useGuardianStageMetrics(rootRef, GUARDIAN_OVERLAYS)
  const layout =
    metrics && def.imageSrc && typeof window !== "undefined"
      ? guardianLayout(metrics, window.innerHeight, window.devicePixelRatio || 1)
      : null
  const rootStyle: CSSProperties | undefined = layout
    ? { left: layout.column.x, top: layout.column.y, width: layout.column.w, height: layout.column.h }
    : undefined
  const hitStyle: CSSProperties | undefined = layout
    ? { left: layout.hit.x, top: layout.hit.y, width: layout.hit.w, height: layout.hit.h }
    : undefined

  const left = fight ? Math.max(0, fight.endsAt - now) / 1000 : def.timeLimitSec
  return (
    <div
      ref={rootRef}
      style={rootStyle}
      className={`clicker-boss${attack && !def.imageSrc ? " is-attack" : ""}${def.imageSrc ? " has-art" : ""}${fight ? " is-fighting" : ""}${def.imageSrc && !layout ? " is-unframed" : ""}`}
      // No `key={attack}` here: re-mounting the whole fight swallowed taps (main dba426e); the art sprite replays its own lunge.
    >
      {fight ? null : <strong>{def.name}</strong>}
      {fight ? (
        <div className="clicker-boss-bars">
          <ClickerHpBar
            tone="boss"
            value={fight.hp}
            max={fight.maxHp}
            label={name}
            valueText={`${formatNumber(Math.max(0, fight.hp))} / ${formatNumber(fight.maxHp)}`}
            ariaLabel={`${name} 체력`}
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
      {layout ? (
        <GuardianSprite
          layout={layout}
          hits={hit}
          attacks={attack}
          defeats={fallen}
          enrage={enrage}
          awakened={isAwakened}
        />
      ) : null}
      <button
        type="button"
        data-sfx="off"
        className="clicker-boss-target"
        style={hitStyle}
        aria-label={fight ? `${name} 공격` : `${def.name}`}
        disabled={!fight}
        onPointerDown={(e) => {
          if (!fight || e.button !== 0) return
          e.preventDefault()
          setHit((n) => n + 1)
          onStrike(e.clientX, e.clientY)
        }}
      >
        {def.imageSrc ? null : (
          <MonsterArt kind={def.kind} />
        )}
      </button>
      {!fight ? (
        <>
          {lost ? <p className="clicker-boss-note">쓰러졌다. 더 강해져서 다시 도전해라.</p> : null}
          <button type="button" className="clicker-danger clicker-boss-start" onClick={onStart}>
            {defeated ? "다시 싸우기" : "수호자에게 도전"} · {def.timeLimitSec}초
          </button>
          {awakened ? (
            <button type="button" className="clicker-danger clicker-boss-start" onClick={awakened.onStart}>
              {awakened.label}에게 도전 · 새벽 조각 +{awakened.reward}
            </button>
          ) : null}
        </>
      ) : null}
      {attack && fight ? <div className="clicker-boss-hurt" key={`hurt-${attack}`} aria-hidden /> : null}
    </div>
  )
}
