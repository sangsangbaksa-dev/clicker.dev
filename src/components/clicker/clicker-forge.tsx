"use client"

import { useState } from "react"
import type { RunState } from "@/domain/entities/clicker"
import { formatNumber } from "@/domain/services/clicker-format"
import { scaledCost, regionCurrencyBalance } from "@/domain/services/clicker-engine"
import { ARMORS, WEAPONS, forgeError, gearOf, playerMaxHp, type GearTier } from "@/domain/services/clicker-lair"
import type { ClickerGame } from "./panels/types"

/** Forge: craft the next weapon (damage per strike) or armor (HP, damage cut) from CORE + world currencies. */
export function ClickerForge({ game, run }: { game: ClickerGame; run: RunState }) {
  const [open, setOpen] = useState(false)
  const gear = gearOf(run)
  const weapon = WEAPONS[gear.weapon]
  const armor = ARMORS[gear.armor]
  return (
    <div className={`clicker-forge${open ? " is-open" : ""}`}>
      <button type="button" className="clicker-ghost clicker-forge-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        🔥 대장간 · {weapon.icon} 피해 {weapon.damage} · {armor.icon} 체력 {playerMaxHp(run)}
      </button>
      {open ? (
        <div className="clicker-forge-slots">
          <button type="button" className="clicker-ghost clicker-forge-close" onClick={() => setOpen(false)}>
            닫기
          </button>
          <ForgeSlot
            label="무기"
            current={`${weapon.icon} ${weapon.name} · 피해 ${weapon.damage}`}
            next={WEAPONS[gear.weapon + 1]}
            nextStat={WEAPONS[gear.weapon + 1] ? `피해 ${WEAPONS[gear.weapon + 1].damage}` : ""}
            error={forgeError(run, game.config, "weapon")}
            run={run}
            game={game}
            onForge={() => game.forge("weapon")}
          />
          <ForgeSlot
            label="방어구"
            current={`${armor.icon} ${armor.name} · 체력 +${armor.hp} · 피해 -${Math.round(armor.reduction * 100)}%`}
            next={ARMORS[gear.armor + 1]}
            nextStat={
              ARMORS[gear.armor + 1]
                ? `체력 +${ARMORS[gear.armor + 1].hp} · 피해 -${Math.round(ARMORS[gear.armor + 1].reduction * 100)}%`
                : ""
            }
            error={forgeError(run, game.config, "armor")}
            run={run}
            game={game}
            onForge={() => game.forge("armor")}
          />
        </div>
      ) : null}
    </div>
  )
}

function ForgeSlot({
  label,
  current,
  next,
  nextStat,
  error,
  run,
  game,
  onForge,
}: {
  label: string
  current: string
  next?: GearTier
  nextStat: string
  error?: string
  run: RunState
  game: ClickerGame
  onForge: () => void
}) {
  return (
    <article className="clicker-forge-slot">
      <p className="clicker-forge-label">{label}</p>
      <p className="clicker-forge-current">{current}</p>
      {next ? (
        <>
          <p className="clicker-forge-next">
            → {next.icon} <b>{next.name}</b> · {nextStat}
          </p>
          <p className="clicker-forge-cost">
            <span className={run.coreEnergy >= scaledCost(run, next.cost.core) ? "" : "is-short"}>
              {formatNumber(scaledCost(run, next.cost.core))} CORE
            </span>
            {next.cost.currencies.map((c) => {
              const region = game.config.regions.find((r) => r.id === c.regionId)
              return (
                <span key={c.regionId} className={regionCurrencyBalance(run, c.regionId) >= c.amount ? "" : "is-short"}>
                  {region?.currency?.icon} {formatNumber(c.amount)} {region?.currency?.name}
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
