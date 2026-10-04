"use client"

import { useMemo, useState } from "react"
import { CLICKER_ASSETS } from "@/data/clicker/catalog"
import { RebirthPhaseArt } from "@/data/clicker/rebirth-assets"
import type { TranscendenceDef } from "@/application/clicker-ui"
import "./clicker-rebirth-worldline-select.css"

type Props = {
  buffs: TranscendenceDef[]
  ownedIds: readonly string[]
  popIcons: Record<string, number>
  onChoose: (buff: TranscendenceDef) => void
}

const SELECT_CONFIRM_MS = 180
const SELECT_CONFIRM_REDUCED_MS = 0

/** Every worldline is one row: icon, name, identity, effect, and the rebirth button. */
export function ClickerRebirthWorldlineSelect({ buffs, ownedIds, popIcons, onChoose }: Props) {
  const [selectBgFailed, setSelectBgFailed] = useState(false)
  const reducedMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  )
  const owned = new Set(ownedIds)

  const choose = (buff: TranscendenceDef) => {
    const delay = reducedMotion ? SELECT_CONFIRM_REDUCED_MS : SELECT_CONFIRM_MS
    if (delay <= 0) {
      onChoose(buff)
      return
    }
    window.setTimeout(() => onChoose(buff), delay)
  }

  return (
    <div className={`clicker-wl-select${reducedMotion ? " is-reduced" : ""}`}>
      <img
        src={selectBgFailed ? CLICKER_ASSETS.bgTranscendence : RebirthPhaseArt.worldlineSelectBg}
        alt=""
        className={`clicker-wl-select-room-bg${selectBgFailed ? "" : " clicker-wl-select-room-bg--hq"}`}
        aria-hidden
        onError={() => setSelectBgFailed(true)}
      />
      <div className="clicker-wl-select-extra">
        {buffs.map((buff) => {
            const walked = owned.has(buff.id)
            return (
              <article
                key={buff.id}
                className={`clicker-card clicker-wl-extra-card${(popIcons[buff.id] ?? 0) > 0 ? " is-pop-icon" : ""}${walked ? " is-walked" : ""}`}
              >
                <img src={RebirthPhaseArt.stampFor(buff.id) ?? buff.assetId} alt="" />
                <div>
                  <strong>
                    {buff.name}
                    {walked ? <em className="clicker-wl-walked">완료</em> : null}
                  </strong>
                  <div style={{ color: "var(--text-2)", fontSize: 12 }}>{buff.identity}</div>
                  <div style={{ fontSize: 12 }}>{buff.description}</div>
                </div>
                <button
                  type="button"
                  className="clicker-primary"
                  disabled={walked}
                aria-label={walked ? `${buff.name} · 이미 걸은 세계선` : `${buff.name} · 환생하기`}
                  onClick={() => choose(buff)}
                >
                  {walked ? "완료" : "환생하기"}
                </button>
              </article>
            )
        })}
      </div>
    </div>
  )
}
