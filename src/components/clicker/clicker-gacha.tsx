"use client"

import { useState } from "react"
import {
  formatNumber,
  gachaCost,
  gachaStarMultiplier,
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
          {last.map((reward, i) => {
            const info = rewardInfo(reward, game)
            return (
              <figure key={i} className={`clicker-gacha-capsule is-${reward.rarity}`} style={{ animationDelay: `${i * 70}ms` }}>
                <span className="clicker-gacha-prize">
                  <img src={ART[reward.rarity]} alt="" />
                  {info.icon ? <img className="clicker-gacha-prize-icon" src={info.icon} alt="" /> : null}
                </span>
                <figcaption>
                  <b>{info.name}</b>
                  <small>
                    {RARITY_LABEL[reward.rarity]} · {info.kind}
                  </small>
                </figcaption>
              </figure>
            )
          })}
          <button type="button" className="clicker-ghost clicker-gacha-close" onClick={() => setLast(null)}>
            닫기
          </button>
        </div>
      ) : null}
    </section>
  )
}
