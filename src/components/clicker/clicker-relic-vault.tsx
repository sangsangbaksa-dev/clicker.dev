"use client"

import {
  formatNumber,
  regionCurrencyBalance,
  relicCost,
  relicEffectAt,
  relicError,
  relicLevel,
  type MetaState,
  type RelicDef,
  type RunState,
} from "@/application/clicker-ui"
import { CurrencyIcon } from "@/components/clicker/clicker-currency-icon"
import type { ClickerGame } from "@/hooks/use-clicker"

/** "채굴 ×2.56 · 번개 확률 +4%" for a relic at a level. */
function relicEffectText(relic: RelicDef, level: number): string {
  if (level <= 0) return "효과 없음"
  const e = relicEffectAt(relic, level)
  const x = (v: number) => `×${+v.toFixed(2)}`
  const pct = (v: number) => `+${+(v * 100).toFixed(1)}%`
  const parts: string[] = []
  if (e.clickMultiplier) parts.push(`채굴 위력 ${x(e.clickMultiplier)}`)
  if (e.productionMultiplier) parts.push(`자동 생산 ${x(e.productionMultiplier)}`)
  if (e.criticalMultiplier) parts.push(`치명타 피해 ${x(e.criticalMultiplier)}`)
  if (e.lightningChanceAdd) parts.push(`번개 확률 ${pct(e.lightningChanceAdd)}`)
  if (e.feverDurationAdd) parts.push(`FEVER +${+e.feverDurationAdd.toFixed(1)}초`)
  if (e.feverIntensity) parts.push(`FEVER 강도 ${pct(e.feverIntensity - 1)}`)
  if (e.comboWindowAdd) parts.push(`콤보 유지 +${+e.comboWindowAdd.toFixed(1)}초`)
  if (e.droneStrikesPerSecond) parts.push(`드론 +${e.droneStrikesPerSecond}회/초`)
  if (e.echoChanceAdd) parts.push(`잔향 확률 ${pct(e.echoChanceAdd)}`)
  return parts.join(" · ")
}

/** Relic Vault: permanent relics bought level by level with world currencies. */
export function ClickerRelicVault({ game, run, meta }: { game: ClickerGame; run: RunState; meta: MetaState }) {
  return (
    <div className="clicker-forge clicker-forge-panel clicker-relic-vault">
      <p className="clicker-forge-summary">
        유물 보관소 · 유물은 <b>환생해도 사라지지 않습니다</b>. 각 월드의 화폐로 강화하세요. 마지막 각성은 9번째 세계선에서 열립니다.
      </p>
      <div className="clicker-forge-slots">
        {game.config.relics.map((relic) => {
          const level = relicLevel(meta, relic.id)
          const maxed = level >= relic.maxLevel
          const ascended = maxed && relic.maxLevel >= 6
          const error = relicError(run, meta, game.config, relic.id)
          const region = game.config.regions.find((r) => r.id === relic.regionId)
          const cost = relicCost(meta, game.config, relic)
          return (
            <article key={relic.id} className={`clicker-forge-slot clicker-relic${maxed ? " is-maxed" : ""}${ascended ? " is-ascended" : ""}`}>
              <p className="clicker-forge-label">
                {relic.name} <small>Lv.{level}/{relic.maxLevel}{ascended ? " · 각성" : ""}</small>
              </p>
              <div className="clicker-forge-items">
                <figure className="clicker-forge-item">
                  <span className={`clicker-relic-art${ascended ? " is-ascended" : ""}`} key={ascended ? "ascended" : "base"}>
                    <img className="clicker-zoomable" src={relic.assetId} alt="" />
                    {ascended ? (
                      <svg className="clicker-relic-ascension-ring" viewBox="0 0 72 72" aria-hidden="true">
                        <circle cx="36" cy="36" r="31" />
                        <circle className="clicker-relic-ascension-inner" cx="36" cy="36" r="24" />
                        <path d="M36 2v8m0 52v8M2 36h8m52 0h8M12 12l6 6m36 36 6 6m0-48-6 6m-36 36-6 6" />
                        <path className="clicker-relic-ascension-glyphs" d="m36 8 2 4-2 4-2-4zm28 28-4 2-4-2 4-2zm-28 28-2-4 2-4 2 4zm-28-28 4-2 4 2-4 2z" />
                      </svg>
                    ) : null}
                  </span>
                  <figcaption>
                    <b>{ascended ? "최종 각성" : maxed ? "완성" : level > 0 ? `현재 Lv.${level}` : "미보유"}</b>
                    <span>{relicEffectText(relic, level)}</span>
                  </figcaption>
                </figure>
                {!maxed ? (
                  <>
                    <span className="clicker-forge-arrow" aria-hidden>
                      →
                    </span>
                    <figure className="clicker-forge-item is-next">
                      <figcaption>
                        <b>Lv.{level + 1}</b>
                        <span>{relicEffectText(relic, level + 1)}</span>
                      </figcaption>
                    </figure>
                  </>
                ) : null}
              </div>
              <p className="clicker-relic-lore">{relic.lore}</p>
              {!maxed ? (
                <>
                  <p className="clicker-forge-cost">
                    <span className={regionCurrencyBalance(run, relic.regionId) >= cost ? "" : "is-short"}>
                      <CurrencyIcon regionId={relic.regionId} /> {formatNumber(cost)} {region?.currency?.name}
                    </span>
                  </p>
                  <button
                    type="button"
                    className={`clicker-primary${error ? " is-unaffordable" : " is-affordable"}`}
                    disabled={Boolean(error)}
                    onClick={() => game.buyRelic(relic.id)}
                  >
                    {error ?? (level > 0 ? "강화하기" : "봉인 해제")}
                  </button>
                </>
              ) : (
                <p className="clicker-forge-next">{ascended ? "세계선의 끝에서 각성" : "최대 레벨"}</p>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}
