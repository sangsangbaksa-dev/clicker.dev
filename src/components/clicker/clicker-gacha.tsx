"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import { createPortal } from "react-dom"
import {
  formatNumber,
  gachaCost,
  gachaFreeReady,
  gachaLegendaryRate,
  gachaStarMultiplier,
  GACHA_FREE_EVERY_MS,
  GACHA_PITY,
  GACHA_SOFT_PITY,
  GACHA_STAR_PRODUCTION,
  type GachaLogEntry,
  type GachaRarity,
  type GachaReward,
  type RunState,
} from "@/application/clicker-ui"
import { playSfx, type SfxName } from "@/lib/clicker-sfx"
import type { ClickerGame } from "./panels/types"
import "./clicker-gacha.css"

const ART = {
  machine: "/clicker/gacha/gacha_machine.webp",
  common: "/clicker/gacha/capsule_common.webp",
  rare: "/clicker/gacha/capsule_rare.webp",
  epic: "/clicker/gacha/capsule_epic.webp",
  legendary: "/clicker/gacha/capsule_legendary.webp",
} as const

const RARITY_LABEL: Record<GachaRarity, string> = { common: "일반", rare: "희귀", epic: "영웅", legendary: "전설" }
const RARITY_RANK: Record<GachaRarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3 }
const RARITY_SFX: Record<GachaRarity, SfxName> = { common: "select", rare: "purchase", epic: "skillUnlock", legendary: "achievement" }
const DROP_MS = 1500
const REVEAL_STEP_MS = 160

/** What the capsule held: its name, a short kind label and its own icon. */
function rewardInfo(reward: GachaReward, game: ClickerGame): { name: string; kind: string; icon?: string } {
  switch (reward.kind) {
    case "skill": {
      const skill = game.config.activeSkills.find((s) => s.id === reward.skillId)
      return { name: `${skill?.name ?? "스킬"} ×${reward.count}`, kind: "액티브 스킬", icon: skill?.assetId }
    }
    case "upgrade": {
      const upgrade = game.config.upgrades.find((u) => u.id === reward.upgradeId)
      return { name: upgrade?.name ?? "업그레이드", kind: "업그레이드", icon: upgrade?.assetId }
    }
    case "circuit": {
      const node = game.config.skillNodes.find((n) => n.id === reward.nodeId)
      return { name: node?.name ?? "스킬 회로", kind: "스킬 회로", icon: node?.assetId }
    }
    case "star":
      return { name: `전설의 별 ${reward.stars}개`, kind: `영구 생산 ×${GACHA_STAR_PRODUCTION}` }
  }
}

function bestRarity(rewards: GachaReward[]): GachaRarity {
  return rewards.reduce<GachaRarity>((best, r) => (RARITY_RANK[r.rarity] > RARITY_RANK[best] ? r.rarity : best), "common")
}

function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}시간 ${m}분` : `${m}분 ${s % 60}초`
}

/** A logged capsule as display info. */
function logInfo(entry: GachaLogEntry, game: ClickerGame): { name: string; kind: string; icon?: string } {
  if (entry.kind === "star") return rewardInfo({ rarity: "legendary", kind: "star", stars: entry.count ?? 1 }, game)
  if (entry.kind === "skill") return rewardInfo({ rarity: entry.rarity, kind: "skill", skillId: entry.id, count: entry.count ?? 1 }, game)
  if (entry.kind === "upgrade") return rewardInfo({ rarity: entry.rarity, kind: "upgrade", upgradeId: entry.id }, game)
  return rewardInfo({ rarity: entry.rarity, kind: "circuit", nodeId: entry.id }, game)
}

function when(at: number, now: number): string {
  const m = Math.floor(Math.max(0, now - at) / 60000)
  if (m < 1) return "방금"
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}시간 전` : `${Math.floor(h / 24)}일 전`
}

type Show = { key: number; count: 1 | 10; rewards: GachaReward[]; phase: "drop" | "reveal"; open: boolean[] }

/** Core capsule gacha: pull for CORE (or the free daily capsule), a capsule-drop reveal, flip cards, pity. */
export function ClickerGacha({ game, run }: { game: ClickerGame; run: RunState }) {
  const [show, setShow] = useState<Show | null>(null)
  const [flash, setFlash] = useState(0)
  const [historyOpen, setHistoryOpen] = useState(false)
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms))

  const meta = game.save?.metaState
  if (!meta) return null
  // The last game tick, so prices and the free timer only move with the game clock (render stays pure).
  const now = run.lastTickAt
  const one = gachaCost(run, meta, game.config, now, 1)
  const ten = gachaCost(run, meta, game.config, now, 10)
  const pity = meta.gachaPity ?? 0
  const stars = meta.gachaStars ?? 0
  const freeReady = gachaFreeReady(meta, now)
  const freeIn = (meta.gachaFreeAt ?? 0) + GACHA_FREE_EVERY_MS - now
  const legendaryRate = gachaLegendaryRate(pity)

  const pull = (count: 1 | 10, free = false) => {
    const rewards = game.pullGacha(count, free)
    if (!rewards) return
    const key = Date.now()
    setShow({ key, count, rewards, phase: "drop", open: rewards.map(() => false) })
    playSfx("purchase")
    later(() => setShow((s) => (s?.key === key ? { ...s, phase: "reveal" } : s)), DROP_MS)
  }

  const flip = (i: number) => {
    setShow((s) => {
      if (!s || s.phase !== "reveal" || s.open[i]) return s
      const reward = s.rewards[i]
      playSfx(RARITY_SFX[reward.rarity])
      if (reward.rarity === "legendary") setFlash((n) => n + 1)
      return { ...s, open: s.open.map((o, j) => o || j === i) }
    })
  }

  const revealAll = () => {
    if (!show) return
    const key = show.key
    let step = 0
    show.open.forEach((o, i) => {
      if (o) return
      later(() => {
        setShow((s) => {
          if (!s || s.key !== key || s.open[i]) return s
          return { ...s, open: s.open.map((x, j) => x || j === i) }
        })
      }, step * REVEAL_STEP_MS)
      step += 1
    })
    // One sound for the whole sweep: the best capsule's.
    const best = bestRarity(show.rewards.filter((_, i) => !show.open[i]))
    later(() => {
      playSfx(RARITY_SFX[best])
      if (best === "legendary") setFlash((n) => n + 1)
    }, Math.max(0, step - 1) * REVEAL_STEP_MS)
  }

  const allOpen = show ? show.open.every(Boolean) : false
  const top = show ? bestRarity(show.rewards) : "common"
  const host = typeof document !== "undefined" ? (document.querySelector("[data-clicker]") ?? document.body) : null

  return (
    <section className="clicker-gacha" aria-labelledby="clicker-gacha-title">
      <img className="clicker-gacha-machine clicker-zoomable" src={ART.machine} alt="" />
      <div className="clicker-gacha-body">
        <h3 id="clicker-gacha-title" className="clicker-shop-section">
          코어 캡슐 · GACHA
        </h3>
        <p className="clicker-gacha-rates">
          전설 2% · 영웅 10% · 희귀 28% · 일반 60% · 10회 뽑기는 희귀 이상 1개 확정
        </p>
        <div className="clicker-gacha-pity" aria-label={`전설 확정까지 ${GACHA_PITY - pity}회`}>
          <div className="clicker-gacha-pity-bar">
            <i style={{ width: `${(pity / GACHA_PITY) * 100}%` }} />
            <b style={{ left: `${(GACHA_SOFT_PITY / GACHA_PITY) * 100}%` }} aria-hidden />
          </div>
          <span>
            전설 확정까지 <strong>{GACHA_PITY - pity}</strong>회 · 다음 전설 확률 <strong>{Math.round(legendaryRate * 100)}%</strong>
            {pity + 1 >= GACHA_SOFT_PITY ? " · 확률 상승 중!" : ""}
          </span>
        </div>
        <ul className="clicker-gacha-legend">
          <li><img src={ART.common} alt="" /> 일반 · 액티브 스킬</li>
          <li><img src={ART.rare} alt="" /> 희귀 · 랜덤 업그레이드</li>
          <li><img src={ART.epic} alt="" /> 영웅 · 랜덤 스킬 회로</li>
          <li><img src={ART.legendary} alt="" /> 전설 · 영구 생산 ×{GACHA_STAR_PRODUCTION}</li>
        </ul>
        {stars > 0 ? (
          <p className="clicker-gacha-stars">
            전설의 별 {stars}개 · 영구 생산 ×{gachaStarMultiplier(meta).toFixed(2)}
          </p>
        ) : null}
        <div className="clicker-gacha-actions">
          <button type="button" className={`clicker-primary clicker-gacha-free${freeReady ? " is-ready" : ""}`} disabled={!freeReady} onClick={() => pull(1, true)}>
            {freeReady ? "무료 뽑기 · 오늘의 캡슐" : `무료 뽑기 · ${clock(freeIn)} 후`}
          </button>
          <button type="button" className="clicker-primary" disabled={run.coreEnergy < one} onClick={() => pull(1)}>
            1회 뽑기 · {formatNumber(one)}
          </button>
          <button type="button" className="clicker-primary clicker-gacha-ten" disabled={run.coreEnergy < ten} onClick={() => pull(10)}>
            10회 뽑기 · {formatNumber(ten)} <small>10% 할인</small>
          </button>
          <button type="button" className="clicker-ghost clicker-gacha-history-open" onClick={() => setHistoryOpen(true)}>
            뽑기 기록 · 효과 보기 ({meta.gachaPulls ?? 0}회)
          </button>
        </div>
      </div>
      {show && host
        ? createPortal(
            <div className={`clicker-gacha-stage is-${show.phase} top-${top}`} role="dialog" aria-modal="true" aria-label="캡슐 개봉">
              {show.phase === "drop" ? (
                <div className="clicker-gacha-drop" aria-hidden>
                  <img className="clicker-gacha-drop-machine" src={ART.machine} alt="" />
                  <span className="clicker-gacha-drop-beam" />
                  <img className="clicker-gacha-drop-capsule" src={ART[top]} alt="" />
                </div>
              ) : (
                <>
                  <p className="clicker-gacha-stage-title">{allOpen ? "획득!" : "캡슐을 눌러 여세요"}</p>
                  <div className={`clicker-gacha-cards is-${show.count === 10 ? "ten" : "one"}`}>
                    {show.rewards.map((reward, i) => {
                      const info = rewardInfo(reward, game)
                      const open = show.open[i]
                      return (
                        <button
                          key={i}
                          type="button"
                          data-sfx="off"
                          className={`clicker-gacha-card is-${reward.rarity}${open ? " is-open" : ""}`}
                          style={{ "--i": i } as CSSProperties}
                          onClick={() => flip(i)}
                          aria-label={open ? `${RARITY_LABEL[reward.rarity]} · ${info.name}` : `캡슐 ${i + 1} 열기`}
                        >
                          <span className="clicker-gacha-card-inner">
                            <span className="clicker-gacha-card-back">
                              <img src={ART[reward.rarity]} alt="" />
                            </span>
                            <span className="clicker-gacha-card-front">
                              <span className="clicker-gacha-card-rarity">{RARITY_LABEL[reward.rarity]}</span>
                              <span className="clicker-gacha-card-art">
                                {info.icon ? <img src={info.icon} alt="" /> : <img src={ART.legendary} alt="" />}
                              </span>
                              <b>{info.name}</b>
                              <small>{info.kind}</small>
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  <div className="clicker-gacha-stage-actions">
                    {allOpen ? (
                      <>
                        <button type="button" className="clicker-ghost" onClick={() => setShow(null)}>
                          확인
                        </button>
                        <button
                          type="button"
                          className="clicker-primary"
                          disabled={run.coreEnergy < (show.count === 10 ? ten : one)}
                          onClick={() => pull(show.count)}
                        >
                          한 번 더 · {formatNumber(show.count === 10 ? ten : one)}
                        </button>
                      </>
                    ) : (
                      <button type="button" className="clicker-primary" onClick={revealAll}>
                        모두 열기
                      </button>
                    )}
                  </div>
                </>
              )}
              {flash ? <span key={flash} className="clicker-gacha-flash" aria-hidden /> : null}
            </div>,
            host,
          )
        : null}
      {historyOpen && host
        ? createPortal(
            (() => {
              const counts = meta.gachaCounts ?? {}
              const log = meta.gachaLog ?? []
              const upgrades = log.filter((e) => e.kind === "upgrade").length
              const circuits = log.filter((e) => e.kind === "circuit").length
              const charges = log.filter((e) => e.kind === "skill").reduce((n, e) => n + (e.count ?? 1), 0)
              return (
                <div className="clicker-gacha-stage clicker-gacha-history" role="dialog" aria-modal="true" aria-labelledby="clicker-gacha-history-title">
                  <div className="clicker-gacha-history-card">
                    <header>
                      <h3 id="clicker-gacha-history-title">뽑기 기록</h3>
                      <button type="button" className="clicker-ghost" onClick={() => setHistoryOpen(false)}>
                        닫기
                      </button>
                    </header>
                    <p className="clicker-gacha-history-total">
                      총 <b>{meta.gachaPulls ?? 0}</b>회 · 전설 <b className="is-legendary">{counts.legendary ?? 0}</b> · 영웅{" "}
                      <b className="is-epic">{counts.epic ?? 0}</b> · 희귀 <b className="is-rare">{counts.rare ?? 0}</b> · 일반 <b>{counts.common ?? 0}</b>
                    </p>
                    <section className="clicker-gacha-history-effects" aria-label="뽑기 효과">
                      <div>
                        <img src={ART.legendary} alt="" />
                        <span>
                          <b>영구 생산 ×{gachaStarMultiplier(meta).toFixed(2)}</b>
                          <small>전설의 별 {stars}개 · 환생해도 유지</small>
                        </span>
                      </div>
                      <div>
                        <img src={ART.epic} alt="" />
                        <span>
                          <b>스킬 회로 {circuits}개</b>
                          <small>무료로 얻은 회로</small>
                        </span>
                      </div>
                      <div>
                        <img src={ART.rare} alt="" />
                        <span>
                          <b>업그레이드 {upgrades}개</b>
                          <small>무료로 얻은 업그레이드</small>
                        </span>
                      </div>
                      <div>
                        <img src={ART.common} alt="" />
                        <span>
                          <b>스킬 충전 {charges}회</b>
                          <small>액티브 스킬 사용 횟수</small>
                        </span>
                      </div>
                    </section>
                    <p className="clicker-gacha-history-note">
                      회로·업그레이드·충전은 최근 {log.length}개 기록 기준 · 전설 확정까지 {GACHA_PITY - pity}회
                    </p>
                    <ol className="clicker-gacha-history-list">
                      {log.length === 0 ? <li className="is-empty">아직 뽑은 캡슐이 없습니다.</li> : null}
                      {log.map((entry, i) => {
                        const info = logInfo(entry, game)
                        return (
                          <li key={i} className={`is-${entry.rarity}`}>
                            <span className="clicker-gacha-history-icon">
                              <img src={info.icon ?? ART[entry.rarity]} alt="" />
                            </span>
                            <span className="clicker-gacha-history-name">
                              <b>{info.name}</b>
                              <small>
                                {RARITY_LABEL[entry.rarity]} · {info.kind}
                              </small>
                            </span>
                            <time>{when(entry.at, now)}</time>
                          </li>
                        )
                      })}
                    </ol>
                  </div>
                </div>
              )
            })(),
            host,
          )
        : null}
    </section>
  )
}
