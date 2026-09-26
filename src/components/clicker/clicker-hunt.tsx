"use client"

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react"
import type { MonsterDef, RegionHuntDef } from "@/domain/entities/clicker"
import type { HuntClaim } from "@/domain/services/clicker-engine"
import { formatNumber } from "@/domain/services/clicker-format"
import {
  HUNT_ATTACKS,
  HUNT_INTRO_MS,
  MONSTER_SIZE,
  abandonHunt,
  createHunt,
  huntScore,
  huntTimeLeftMs,
  isHuntOver,
  isMonsterAlive,
  stepHunt,
  strikeMiss,
  strikeMonster,
  summarizeHunt,
  type HuntEvent,
  type HuntEventKind,
  type HuntMonster,
  type HuntState,
} from "@/domain/services/clicker-hunt"
import { HuntSpriteDefs, MonsterSprite, weakSpot } from "@/components/clicker/clicker-monster-sprite"
import { playHuntCue, type HuntCue } from "@/components/clicker/clicker-sfx"
import "./clicker-hunt.css"

type Props = {
  def: RegionHuntDef
  monsters: MonsterDef[]
  regionName: string
  background: string
  loadout: { power: number; critChance: number }
  /** CORE a score of 1 would pay right now (reward preview only; the claim recomputes it). */
  rewardAtFull: number
  /** Hunt settled (finished, lost, or left mid-fight). */
  onFinish: (claim: HuntClaim) => void
  /** Closed during the intro: nothing is claimed and no cooldown starts. */
  onCancel: () => void
}

type Shot = { id: number; x: number; y: number; at: number; weak: boolean }

const SHOT_MS = 150
const FX_MS = 900
const SHAKE_MS = 420

const CUE_FOR: Partial<Record<HuntEventKind, HuntCue>> = {
  hit: "hit",
  crit: "crit",
  weak: "weak",
  kill: "kill",
  boss_kill: "bossKill",
  charge: "charge",
  interrupt: "interrupt",
  shield: "shield",
  miss: "miss",
  wave: "wave",
  boss: "boss",
  adds: "adds",
  enrage: "enrage",
  won: "won",
  lost: "lost",
  timeout: "timeout",
}

const OUTCOME_TITLE = { won: "토벌 성공", lost: "보호막 붕괴 · 퇴각", timeout: "시간 종료" } as const

/** Deterministic jitter from an event id, so floating numbers don't jump between frames. */
function jitter(id: number, spread: number): number {
  const s = Math.sin(id * 12.9898) * 43758.5453
  return (s - Math.floor(s) - 0.5) * spread
}

/**
 * Full-screen monster hunt: intro, three waves, the region boss, and a result card.
 * The domain module owns every rule; this component steps it on rAF and paints it.
 */
export function ClickerHunt({ def, monsters, regionName, background, loadout, rewardAtFull, onFinish, onCancel }: Props) {
  const [hunt, setHunt] = useState<HuntState>(() => createHunt(def, monsters, loadout))
  const huntRef = useRef(hunt)
  const [shots, setShots] = useState<Shot[]>([])
  const shotId = useRef(0)
  const fieldRef = useRef<HTMLDivElement>(null)
  const [field, setField] = useState({ w: 0, h: 0 })
  const lastEventId = useRef(0)
  const settled = useRef(false)

  const commit = useCallback((next: HuntState) => {
    huntRef.current = next
    setHunt(next)
  }, [])

  // Measure the field for sprite sizes and laser geometry.
  useEffect(() => {
    const el = fieldRef.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      setField({ w: r.width, h: r.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Play a cue for every event the simulation emitted since the last frame.
  const playNewEvents = useCallback((state: HuntState) => {
    for (const e of state.events) {
      if (e.id <= lastEventId.current) continue
      lastEventId.current = e.id
      const cue = CUE_FOR[e.kind]
      if (cue) playHuntCue(cue)
    }
  }, [])

  // Frame loop: step the hunt, prune finished shots. Stops once the hunt is over.
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const loop = (t: number) => {
      const dt = t - last
      last = t
      const cur = huntRef.current
      if (!isHuntOver(cur)) {
        const next = stepHunt(cur, dt, def, monsters, Math.random)
        playNewEvents(next)
        commit(next)
        setShots((prev) => (prev.length && prev.some((s) => next.elapsed - s.at > SHOT_MS) ? prev.filter((s) => next.elapsed - s.at <= SHOT_MS) : prev))
      }
      raf = window.requestAnimationFrame(loop)
    }
    raf = window.requestAnimationFrame(loop)
    return () => window.cancelAnimationFrame(raf)
  }, [def, monsters, commit, playNewEvents])

  const fireShot = (clientX: number, clientY: number, weak: boolean) => {
    const el = fieldRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const id = ++shotId.current
    setShots((prev) => [...prev.slice(-6), { id, x: clientX - r.left, y: clientY - r.top, at: huntRef.current.elapsed, weak }])
    playHuntCue("shot")
  }

  const onMonsterDown = (e: ReactPointerEvent<HTMLButtonElement>, m: HuntMonster) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const cur = huntRef.current
    if (cur.phase !== "fight") return
    const rect = e.currentTarget.getBoundingClientRect()
    const spot = weakSpot(m.archetype, def.look)
    const dx = (e.clientX - rect.left) / rect.width - spot.x
    const dy = (e.clientY - rect.top) / rect.height - spot.y
    const onWeak = Math.hypot(dx, dy) <= spot.r
    fireShot(e.clientX, e.clientY, onWeak && m.weakUntil > cur.elapsed)
    const next = strikeMonster(cur, m.uid, onWeak, def, monsters, Math.random)
    playNewEvents(next)
    commit(next)
  }

  const onFieldDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const cur = huntRef.current
    if (cur.phase !== "fight") return
    const el = fieldRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    fireShot(e.clientX, e.clientY, false)
    const next = strikeMiss(cur, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height)
    playNewEvents(next)
    commit(next)
  }

  const finish = useCallback(() => {
    if (settled.current) return
    settled.current = true
    const s = summarizeHunt(huntRef.current)
    onFinish({
      score: s.score,
      kills: s.kills,
      bossDown: s.bossDown,
      flawless: s.flawless,
      cleared: s.outcome === "won",
    })
  }, [onFinish])

  const leave = useCallback(() => {
    const cur = huntRef.current
    if (cur.phase === "intro") {
      settled.current = true
      onCancel()
      return
    }
    if (isHuntOver(cur)) {
      finish()
      return
    }
    const next = abandonHunt(cur)
    playNewEvents(next)
    commit(next)
  }, [commit, finish, onCancel, playNewEvents])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.preventDefault()
      leave()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [leave])

  const t = hunt.elapsed
  const unit = Math.min(field.w, field.h)
  const over = isHuntOver(hunt)
  const recent = (kind: HuntEventKind, ms: number) => hunt.events.find((e) => e.kind === kind && t - e.at < ms)
  const shaking = !over && Boolean(recent("shield", SHAKE_MS))
  const bossShake = Boolean(recent("boss_kill", 700))
  const hurt = recent("shield", 600)
  const banner = recent("boss", 1900) ?? recent("wave", 1200)
  const enrage = recent("enrage", 1400)
  const boss = hunt.monsters.find((m) => m.archetype === "BOSS" && m.deadAt < 0 && m.bornAt <= t)
  const timeLeft = huntTimeLeftMs(hunt)
  const score = huntScore(hunt)
  const summary = over ? summarizeHunt(hunt) : null
  const introLeft = hunt.phase === "intro" ? Math.max(0, HUNT_INTRO_MS - t) : 0

  const style = { "--m-h": String(def.hue), backgroundImage: `url(${background})` } as CSSProperties

  return (
    <div
      className={`clicker-hunt look-${def.look}${shaking ? " is-shaking" : ""}${bossShake ? " is-quaking" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={`${def.name} · 몬스터 사냥`}
      style={style}
    >
      <HuntSpriteDefs />
      <div className="clicker-hunt-bg" aria-hidden />
      <header className="clicker-hunt-hud">
        <div className="clicker-hunt-title">
          <p>{regionName} · MONSTER HUNT</p>
          <h2>{def.name}</h2>
        </div>
        <ol className="clicker-hunt-waves" aria-label={`웨이브 ${Math.min(hunt.wave + 1, hunt.waveCount)}/${hunt.waveCount}`}>
          {Array.from({ length: hunt.waveCount }, (_, i) => (
            <li
              key={i}
              className={`${i < hunt.wave || (over && hunt.bossDown) ? "is-done" : i === hunt.wave && hunt.phase !== "intro" ? "is-now" : ""}${i === hunt.waveCount - 1 ? " is-boss" : ""}`}
            >
              {i === hunt.waveCount - 1 ? "BOSS" : i + 1}
            </li>
          ))}
        </ol>
        <div className="clicker-hunt-shields" aria-label={`보호막 ${hunt.shields}/${hunt.maxShields}`}>
          {Array.from({ length: hunt.maxShields }, (_, i) => (
            <span key={i} className={i < hunt.shields ? "is-up" : "is-broken"} aria-hidden />
          ))}
        </div>
        <div className="clicker-hunt-clock" role="timer" aria-label={`남은 시간 ${Math.ceil(timeLeft / 1000)}초`}>
          <strong className={timeLeft < 10_000 && !over ? "is-low" : ""}>{(timeLeft / 1000).toFixed(1)}</strong>
          <span>초</span>
        </div>
        <div className="clicker-hunt-timebar" aria-hidden>
          <i style={{ width: `${(timeLeft / hunt.timeLimitMs) * 100}%` }} />
        </div>
      </header>

      {boss ? (
        <div className={`clicker-hunt-bossbar${boss.hp <= boss.maxHp / 3 ? " is-enraged" : ""}`} role="status" aria-label={`${boss.name} 체력 ${Math.ceil(boss.hp)}`}>
          <span>{boss.name}</span>
          <div>
            <i style={{ width: `${(boss.hp / boss.maxHp) * 100}%` }} />
            <b style={{ width: `${(boss.hp / boss.maxHp) * 100}%` }} />
          </div>
        </div>
      ) : null}

      <div ref={fieldRef} className="clicker-hunt-field" onPointerDown={onFieldDown}>
        {hunt.monsters.map((m) =>
          m.bornAt > t ? null : (
            <Monster key={m.uid} m={m} t={t} unit={unit} field={field} look={def.look} onDown={onMonsterDown} />
          ),
        )}

        <HuntFx events={hunt.events} t={t} field={field} />

        <svg className="clicker-hunt-shots" aria-hidden>
          {shots.map((s) => (
            <g key={s.id} className={`clicker-hunt-shot${s.weak ? " is-weak" : ""}`}>
              <line x1={field.w / 2} y1={field.h + 12} x2={s.x} y2={s.y} className="glow" />
              <line x1={field.w / 2} y1={field.h + 12} x2={s.x} y2={s.y} className="core" />
              <circle cx={s.x} cy={s.y} r={s.weak ? 18 : 11} className="flash" />
            </g>
          ))}
        </svg>

        {hunt.combo >= 3 && !over ? (
          <div className="clicker-hunt-combo" key={hunt.combo >= 10 ? "hot" : "warm"} aria-hidden>
            <strong>{hunt.combo}</strong>
            <span>COMBO{hunt.combo >= 10 ? " · 화력 증폭" : ""}</span>
          </div>
        ) : null}

        {hurt ? <div key={hurt.id} className="clicker-hunt-hurt" aria-hidden /> : null}

        {banner && !over ? (
          <div key={banner.id} className={`clicker-hunt-banner${banner.kind === "boss" ? " is-boss" : ""}`} role="status">
            {banner.kind === "boss" ? (
              <>
                <em>WARNING</em>
                <strong>{monsters.find((d) => d.id === def.boss)?.name}</strong>
                <span>보스 출현 · 붉은 고리가 차오르면 연타로 끊으세요</span>
              </>
            ) : (
              <>
                <em>WAVE</em>
                <strong>
                  {banner.amount} / {hunt.waveCount - 1}
                </strong>
              </>
            )}
          </div>
        ) : null}

        {enrage && !over ? (
          <div key={enrage.id} className="clicker-hunt-enrage" role="status">
            분노 · 공격이 빨라집니다
          </div>
        ) : null}

        {hunt.phase === "intro" ? (
          <div className="clicker-hunt-intro">
            <p className="clicker-hunt-intro-kicker">MONSTER HUNT</p>
            <h3>{def.name}</h3>
            <p className="clicker-hunt-intro-desc">{def.description}</p>
            <ul className="clicker-hunt-tips">
              <li>
                <b className="tip-tap" /> 몬스터를 탭하면 레이저가 발사됩니다
              </li>
              <li>
                <b className="tip-ring" /> 붉은 고리 = 공격 충전 · 연타로 끊으면 기절
              </li>
              <li>
                <b className="tip-core" /> 빛나는 코어 = 약점 · 피해 ×3
              </li>
              <li>
                <b className="tip-shield" /> 보호막 3개 · 모두 잃으면 퇴각
              </li>
            </ul>
            <strong className="clicker-hunt-intro-count" aria-live="assertive">
              {Math.max(1, Math.ceil(introLeft / 800))}
            </strong>
          </div>
        ) : null}

        {summary ? (
          <div className={`clicker-hunt-result is-${summary.outcome}`}>
            <p className="clicker-hunt-result-kicker">{def.name}</p>
            <h3>{OUTCOME_TITLE[summary.outcome]}</h3>
            {summary.flawless ? <p className="clicker-hunt-flawless">FLAWLESS · 무결점</p> : null}
            <strong className="clicker-hunt-result-score">{Math.round(score * 100)}%</strong>
            <p className="clicker-hunt-result-reward">+{formatNumber(rewardAtFull * score)} CORE</p>
            <dl className="clicker-hunt-result-stats">
              <div>
                <dt>처치</dt>
                <dd>{summary.kills}</dd>
              </div>
              <div>
                <dt>피해</dt>
                <dd>{Math.round(summary.damageShare * 100)}%</dd>
              </div>
              <div>
                <dt>약점 적중</dt>
                <dd>{summary.weakHits}</dd>
              </div>
              <div>
                <dt>공격 차단</dt>
                <dd>{summary.interrupts}</dd>
              </div>
              <div>
                <dt>최고 콤보</dt>
                <dd>{summary.bestCombo}</dd>
              </div>
              <div>
                <dt>명중률</dt>
                <dd>{Math.round(summary.accuracy * 100)}%</dd>
              </div>
            </dl>
            <button type="button" className="clicker-primary clicker-hunt-claim" autoFocus onClick={finish}>
              보상 받기
            </button>
          </div>
        ) : null}
      </div>

      {!over ? (
        <button type="button" className="clicker-hunt-leave" onClick={leave}>
          {hunt.phase === "intro" ? "취소 · Esc" : "퇴각 · Esc"}
        </button>
      ) : null}
    </div>
  )
}

function Monster({
  m,
  t,
  unit,
  field,
  look,
  onDown,
}: {
  m: HuntMonster
  t: number
  unit: number
  field: { w: number; h: number }
  look: RegionHuntDef["look"]
  onDown: (e: ReactPointerEvent<HTMLButtonElement>, m: HuntMonster) => void
}) {
  const size = MONSTER_SIZE[m.archetype] * unit
  const dead = m.deadAt >= 0
  const alive = isMonsterAlive(m, t)
  const attack = HUNT_ATTACKS[m.archetype]
  const enraged = m.archetype === "BOSS" && m.hp <= m.maxHp / 3
  const chargeMs = attack ? attack.charge * (enraged ? 0.8 : 1) : 1
  const charging = alive && m.chargeFrom >= 0
  const progress = charging ? Math.min(1, (t - m.chargeFrom) / chargeMs) : 0
  const cls = [
    "clicker-hunt-monster",
    `is-${m.archetype.toLowerCase()}`,
    dead ? "is-dead" : "",
    t - m.bornAt < 450 ? "is-spawning" : "",
    alive && t - m.lastHitAt < 110 ? "is-hit" : "",
    alive && m.weakUntil > t ? "is-weak" : "",
    alive && m.stunUntil > t ? "is-stunned" : "",
    charging ? "is-charging" : "",
    charging && progress > 0.7 ? "is-imminent" : "",
    enraged && alive ? "is-enraged" : "",
    m.vx < 0 ? "is-facing-left" : "",
  ]
    .filter(Boolean)
    .join(" ")
  const style = {
    left: m.x * field.w,
    top: m.y * field.h,
    width: size,
    height: size,
    "--charge": String(progress),
    zIndex: m.archetype === "BRUTE" || m.archetype === "BOSS" ? 1 : 2,
  } as CSSProperties
  return (
    <button
      type="button"
      className={cls}
      style={style}
      disabled={!alive}
      aria-label={`${m.name} · 체력 ${Math.ceil(m.hp)}/${m.maxHp}${charging ? " · 공격 충전 중" : ""}${m.weakUntil > t ? " · 약점 노출" : ""}`}
      onPointerDown={(e) => onDown(e, m)}
    >
      <span className="clicker-hunt-monster-shadow" aria-hidden />
      <span className="clicker-hunt-monster-art" aria-hidden>
        <MonsterSprite archetype={m.archetype} look={look} />
      </span>
      {charging && attack ? (
        <span className="clicker-hunt-charge" aria-hidden>
          <span className="clicker-hunt-charge-pips">
            {Array.from({ length: attack.interruptHits }, (_, i) => (
              <i key={i} className={i < m.chargeHits ? "is-on" : ""} />
            ))}
          </span>
        </span>
      ) : null}
      {m.stunUntil > t && alive ? <span className="clicker-hunt-stun" aria-hidden /> : null}
      {m.archetype !== "BOSS" && alive ? (
        <span className="clicker-hunt-hp" aria-hidden>
          <i style={{ width: `${(m.hp / m.maxHp) * 100}%` }} />
        </span>
      ) : null}
    </button>
  )
}

/** Damage numbers, interrupt stamps and kill bursts, all keyed to hunt events. */
function HuntFx({ events, t, field }: { events: HuntEvent[]; t: number; field: { w: number; h: number } }) {
  return (
    <div className="clicker-hunt-fx" aria-hidden>
      {events.map((e) => {
        if (t - e.at > FX_MS) return null
        const x = e.x * field.w
        const y = e.y * field.h
        switch (e.kind) {
          case "hit":
          case "crit":
          case "weak":
            return (
              <span
                key={e.id}
                className={`clicker-hunt-dmg is-${e.kind}`}
                style={{ left: x + jitter(e.id, 60), top: y - 20 + jitter(e.id + 7, 24) }}
              >
                {e.kind === "weak" ? "약점 " : ""}
                {(e.amount ?? 0) >= 10 ? Math.round(e.amount ?? 0) : (e.amount ?? 0).toFixed(1)}
              </span>
            )
          case "interrupt":
            return (
              <span key={e.id} className="clicker-hunt-stamp" style={{ left: x, top: y }}>
                차단!
              </span>
            )
          case "kill":
          case "boss_kill":
            return (
              <span key={e.id} className={`clicker-hunt-burst${e.kind === "boss_kill" ? " is-boss" : ""}`} style={{ left: x, top: y }}>
                {Array.from({ length: e.kind === "boss_kill" ? 18 : 10 }, (_, i) => (
                  <i key={i} style={{ "--a": `${(i / (e.kind === "boss_kill" ? 18 : 10)) * 360 + jitter(e.id + i, 20)}deg` } as CSSProperties} />
                ))}
                <b />
              </span>
            )
          case "shield":
            return <span key={e.id} className="clicker-hunt-blast" style={{ left: x, top: y }} />
          default:
            return null
        }
      })}
    </div>
  )
}
