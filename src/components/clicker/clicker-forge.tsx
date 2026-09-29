"use client"

import type { RunState } from "@/domain/entities/clicker"
import { formatNumber } from "@/domain/services/clicker-format"
import { scaledCost, regionCurrencyBalance } from "@/domain/services/clicker-engine"
import {
  AMULETS,
  ARMORS,
  GEAR,
  GEAR_SLOTS,
  HELMETS,
  WEAPONS,
  forgeError,
  gearImage,
  gearOf,
  lairAttackEveryMs,
  playerMaxHp,
  type GearSlot,
  type GearTier,
} from "@/domain/services/clicker-lair"
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
