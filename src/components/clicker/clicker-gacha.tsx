"use client"

import { useState } from "react"
import {
  formatNumber,
  gachaCost,
  gachaStarMultiplier,
  GACHA_BOOST_MULTIPLIER,
  GACHA_BOOST_SECONDS,
  GACHA_PITY,
  GACHA_STAR_PRODUCTION,
  type GachaRarity,
  type GachaReward,
  type RunState,
} from "@/application/clicker-ui"
import type { ClickerGame } from "./panels/types"

const ART = {
  machine: "/clicker/gacha/gacha_machine.webp",
  common: "/clicker/gacha/capsule_common.webp",
  rare: "/clicker/gacha/capsule_rare.webp",
  epic: "/clicker/gacha/capsule_epic.webp",
  legendary: "/clicker/gacha/capsule_legendary.webp",
} as const

const RARITY_LABEL: Record<GachaRarity, string> = { common: "일반", rare: "희귀", epic: "영웅", legendary: "전설" }

function rewardText(reward: GachaReward, game: ClickerGame): string {
  switch (reward.kind) {
    case "core":
      return `CORE +${formatNumber(reward.amount)}`
    case "boost":
      return `생산 ×${reward.multiplier} · ${reward.seconds}초 + CORE ${formatNumber(reward.amount)}`
    case "currency": {
      const region = game.config.regions.find((r) => r.id === reward.regionId)
      return `${region?.currency?.name ?? "지역 화폐"} +${formatNumber(reward.amount)}`
    }
    case "star":
      return `전설의 별 ${reward.stars}개 · 영구 생산 ×${GACHA_STAR_PRODUCTION}`
  }
}

/** Core capsule gacha: pull for CORE, reveal capsules by rarity, legendary pity counter. */
export function ClickerGacha({ game, run }: { game: ClickerGame; run: RunState }) {
  const [last, setLast] = useState<GachaReward[] | null>(null)
  const meta = game.save?.metaState
  if (!meta) return null
  // The last game tick, so the price only moves with the game clock (and render stays pure).
  const now = run.lastTickAt
  const one = gachaCost(run, meta, game.config, now, 1)
  const ten = gachaCost(run, meta, game.config, now, 10)
  const pity = meta.gachaPity ?? 0
  const stars = meta.gachaStars ?? 0
  const pull = (count: 1 | 10) => {
    const rewards = game.pullGacha(count)
    if (rewards) setLast(rewards)
  }
  return (
    <section className="clicker-gacha" aria-labelledby="clicker-gacha-title">
      <img className="clicker-gacha-machine clicker-zoomable" src={ART.machine} alt="" />
      <div className="clicker-gacha-body">
        <h3 id="clicker-gacha-title" className="clicker-shop-section">
          코어 캡슐 · GACHA
        </h3>
        <p className="clicker-gacha-rates">
          전설 2% · 영웅 10% · 희귀 28% · 일반 60% — {GACHA_PITY}회 안에 전설 확정 (남은 {GACHA_PITY - pity}회)
        </p>
        <ul className="clicker-gacha-legend">
          <li><img src={ART.common} alt="" /> 일반 · CORE</li>
          <li><img src={ART.rare} alt="" /> 희귀 · 생산 ×{GACHA_BOOST_MULTIPLIER} {GACHA_BOOST_SECONDS}초</li>
          <li><img src={ART.epic} alt="" /> 영웅 · 지역 화폐</li>
          <li><img src={ART.legendary} alt="" /> 전설 · 영구 생산 ×{GACHA_STAR_PRODUCTION}</li>
        </ul>
        {stars > 0 ? (
          <p className="clicker-gacha-stars">
            전설의 별 {stars}개 · 영구 생산 ×{gachaStarMultiplier(meta).toFixed(2)}
          </p>
        ) : null}
        <div className="clicker-gacha-actions">
          <button type="button" className="clicker-primary" disabled={run.coreEnergy < one} onClick={() => pull(1)}>
            1회 뽑기 · {formatNumber(one)}
          </button>
          <button type="button" className="clicker-primary" disabled={run.coreEnergy < ten} onClick={() => pull(10)}>
            10회 뽑기 · {formatNumber(ten)}
          </button>
        </div>
      </div>
      {last ? (
        <div className="clicker-gacha-result" role="status" aria-live="polite">
          {last.map((reward, i) => (
            <figure key={i} className={`clicker-gacha-capsule is-${reward.rarity}`} style={{ animationDelay: `${i * 70}ms` }}>
              <img src={ART[reward.rarity]} alt="" />
              <figcaption>
                <b>{RARITY_LABEL[reward.rarity]}</b>
                <small>{rewardText(reward, game)}</small>
              </figcaption>
            </figure>
          ))}
          <button type="button" className="clicker-ghost clicker-gacha-close" onClick={() => setLast(null)}>
            닫기
          </button>
        </div>
      ) : null}
    </section>
  )
}
