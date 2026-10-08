"use client"

import {
  AMULETS,
  ARMORS,
  GEAR,
  GEAR_SLOTS,
  HELMETS,
  WEAPONS,
  FORGE_SUCCESS_RATES,
  forgeError,
  formatNumber,
  gearImage,
  gearOf,
  lairAttackEveryMs,
  playerMaxHp,
  regionCurrencyBalance,
  scaledCost,
  type GearSlot,
  type GearTier,
  type RunState,
} from "@/application/clicker-ui"
import { CurrencyIcon } from "@/components/clicker/clicker-currency-icon"
import type { ClickerGame } from "./panels/types"

const SLOT_LABEL: Record<GearSlot, string> = { weapon: "무기", armor: "방어구", helmet: "투구", amulet: "장신구" }

/** One line describing what a tier does in its slot. */
function tierStat(slot: GearSlot, index: number): string {
  switch (slot) {
    case "weapon":
      return `피해 ${WEAPONS[index].damage}`
    case "armor":
      return `체력 +${ARMORS[index].hp} · 받는 피해 -${Math.round(ARMORS[index].reduction * 100)}%`
    case "helmet":
      return `체력 +${HELMETS[index].hp}`
    case "amulet":
      return `보스 공격 간격 +${Math.round(AMULETS[index].slow * 100)}%`
  }
}

/** Forge panel: four gear slots, each crafted tier by tier from CORE + world currencies. */
export function ClickerForge({ game, run }: { game: ClickerGame; run: RunState }) {
  const gear = gearOf(run)
  return (
    <div className="clicker-forge clicker-forge-panel">
      <p className="clicker-forge-summary">
        대장간 · 피해 <b>{WEAPONS[gear.weapon].damage}</b> · 체력 <b>{playerMaxHp(run)}</b> · 보스 공격 간격{" "}
        <b>{(lairAttackEveryMs(run) / 1000).toFixed(1)}초</b>
      </p>
      <details className="clicker-forge-odds">
        <summary>강화 확률표</summary>
        <p>
          상위 등급으로 갈수록 성공 확률이 크게 낮아집니다. 강화할 때마다 비용이 들고, 실패하면 등급은 그대로입니다.
          실패할 때마다 다음 확률이 기본 확률의 10%씩 올라가고(최대 2배), 장인의 기운이 쌓여 100%가 되면 다음 강화는 반드시 성공합니다.
        </p>
        <table>
          <thead>
            <tr>
              <th>등급</th>
              {FORGE_SUCCESS_RATES.slice(1).map((_, i) => (
                <th key={i}>{i + 2}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>성공</td>
              {FORGE_SUCCESS_RATES.slice(1).map((rate, i) => (
                <td key={i}>{`${(rate * 100).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}%`}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </details>
      <div className="clicker-forge-slots">
        {GEAR_SLOTS.map((slot) => (
          <ForgeSlot
            key={slot}
            slot={slot}
            index={gear[slot]}
            error={forgeError(run, game.config, slot)}
            run={run}
            game={game}
            onForge={() => game.forge(slot)}
          />
        ))}
      </div>
    </div>
  )
}

function ForgeSlot({
  slot,
  index,
  error,
  run,
  game,
  onForge,
}: {
  slot: GearSlot
  index: number
  error?: string
  run: RunState
  game: ClickerGame
  onForge: () => void
}) {
  const list = GEAR[slot]
  const current = list[index]
  const next: GearTier | undefined = list[index + 1]
  return (
    <article className="clicker-forge-slot">
      <p className="clicker-forge-label">
        {SLOT_LABEL[slot]} <small>{index + 1}/{list.length}</small>
      </p>
      <div className="clicker-forge-items">
        <figure className="clicker-forge-item">
          <img className="clicker-zoomable" src={gearImage(current)} alt="" />
          <figcaption>
            <b>{current.name}</b>
            <span>{tierStat(slot, index)}</span>
          </figcaption>
        </figure>
        {next ? (
          <>
            <span className="clicker-forge-arrow" aria-hidden>
              →
            </span>
            <figure className="clicker-forge-item is-next">
              <img className="clicker-zoomable" src={gearImage(next)} alt="" />
              <figcaption>
                <b>{next.name}</b>
                <span>{tierStat(slot, index + 1)}</span>
              </figcaption>
            </figure>
          </>
        ) : null}
      </div>
      {next ? (
        <>
          <p className="clicker-forge-cost">
            <span className={run.coreEnergy >= scaledCost(run, next.cost.core) ? "" : "is-short"}>
              {formatNumber(scaledCost(run, next.cost.core))} CORE
            </span>
            {next.cost.currencies.map((c) => {
              const region = game.config.regions.find((r) => r.id === c.regionId)
              return (
                <span key={c.regionId} className={regionCurrencyBalance(run, c.regionId) >= c.amount ? "" : "is-short"}>
                  <CurrencyIcon regionId={c.regionId} /> {formatNumber(c.amount)} {region?.currency?.name}
                </span>
              )
            })}
          </p>
          <button type="button" className={`clicker-primary${error ? " is-unaffordable" : " is-affordable"}`} disabled={Boolean(error)} onClick={onForge}>
            {error ?? "제작하기"}
          </button>
        </>
      ) : (
        <p className="clicker-forge-next">최고 등급</p>
      )}
    </article>
  )
}
