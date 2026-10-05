"use client"

import { useEffect, useState } from "react"
import { formatNumber } from "@/application/clicker-ui"

export type LairInfoNumbers = {
  bossName: string
  bossHp: number
  bossDamage: number
  attackEverySec: number
  weaponName: string
  weaponDamage: number
  huntMultiplier: number
  armorName: string
  armorReduction: number
  playerHp: number
  shieldMin: number
  respawnSec: number
  rewardSeconds: number
}

/** "상세" button at the top right of a hunting ground: how damage works in the lair, with today's numbers. */
export function ClickerLairInfo({ info }: { info: LairInfoNumbers }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        setOpen(false)
      }
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [open])

  const hit = Math.max(1, Math.round(info.weaponDamage * info.huntMultiplier))
  const taken = Math.max(1, Math.round(info.bossDamage * (1 - info.armorReduction)))
  const strikes = Math.ceil(info.bossHp / hit)
  const survive = Math.max(0, Math.ceil(info.playerHp / taken) - 1)
  const timeLimit = (survive + 1) * info.attackEverySec

  return (
    <>
      <button type="button" className="clicker-lair-info-btn" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        상세
      </button>
      {open ? (
        <div className="clicker-lair-info" role="dialog" aria-modal="true" aria-labelledby="clicker-lair-info-title" onClick={() => setOpen(false)}>
          <section onClick={(e) => e.stopPropagation()}>
            <header>
              <h3 id="clicker-lair-info-title">{info.bossName} · 토벌 규칙</h3>
              <button type="button" className="clicker-ghost" onClick={() => setOpen(false)}>
                닫기
              </button>
            </header>

            <h4>내가 주는 피해</h4>
            <p className="clicker-lair-info-formula">
              무기 피해 <b>{info.weaponDamage}</b> × 사냥 회로 <b>×{info.huntMultiplier.toFixed(2).replace(/\.?0+$/, "")}</b> = 탭 1회당{" "}
              <b>{hit}</b>
            </p>
            <ul>
              <li>보스를 탭할 때마다 들어갑니다. 채굴 배율·치명타·FEVER는 적용되지 않습니다.</li>
              <li>탭은 초당 최대 11회까지 인정됩니다.</li>
              <li>
                {info.bossName} 체력 <b>{formatNumber(info.bossHp)}</b> → 지금 무기({info.weaponName})로 <b>{strikes}회</b> 탭
              </li>
            </ul>

            <h4>보스가 주는 피해</h4>
            <p className="clicker-lair-info-formula">
              보스 공격 <b>{info.bossDamage}</b> × (1 − 방어구 감소 <b>{Math.round(info.armorReduction * 100)}%</b>) = 한 번에{" "}
              <b>{taken}</b>
            </p>
            <ul>
              <li>
                보스는 <b>{info.attackEverySec.toFixed(1)}초</b>마다 공격합니다. 장신구가 이 간격을 늘립니다.
              </li>
              <li>
                내 체력 <b>{info.playerHp}</b> (기본 100 + 방어구 + 투구) → <b>{survive}번</b> 버티고, 약{" "}
                <b>{timeLimit.toFixed(0)}초</b> 안에 쓰러뜨려야 합니다
              </li>
            </ul>

            <h4>승패</h4>
            <ul>
              <li>
                체력이 0이 되면 쓰러지고, 보스가 <b>{info.shieldMin}분</b> 동안 보호막을 칩니다.
              </li>
              <li>
                쓰러뜨리면 생산 <b>{info.rewardSeconds}초분</b>(+채굴 보너스)의 CORE를 얻고, 보스는 <b>{info.respawnSec}초</b> 뒤 돌아옵니다.
              </li>
              <li>전투 중 앱을 벗어나면 패배 없이 전투가 취소됩니다.</li>
            </ul>

            <h4>강해지려면</h4>
            <ul>
              <li>대장간: 무기(피해) · 방어구(체력, 피해 감소) · 투구(체력) · 장신구(보스 공격 간격)</li>
              <li>스킬 회로 HUNT 가지: 크리처 피해 배율</li>
            </ul>
          </section>
        </div>
      ) : null}
    </>
  )
}
