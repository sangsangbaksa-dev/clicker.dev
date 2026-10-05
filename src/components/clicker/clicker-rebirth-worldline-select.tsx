"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { CLICKER_ASSETS } from "@/data/clicker/catalog"
import { RebirthPhaseArt } from "@/data/clicker/rebirth-assets"
import { REBIRTH_CHOICE_IDLE, pickRebirthWorldline, rebirthConfirmDelayMs, rebirthKeyframePreloadOrder, type RebirthChoiceState } from "@/application/clicker-ui"
import type { TranscendenceDef } from "@/application/clicker-ui"
import "./clicker-rebirth-worldline-select.css"

type Props = {
  buffs: TranscendenceDef[]
  ownedIds: readonly string[]
  popIcons: Record<string, number>
  onChoose: (buff: TranscendenceDef) => void
}

/** Every worldline is one row: icon, name, identity, effect, and the rebirth button. */
export function ClickerRebirthWorldlineSelect({ buffs, ownedIds, popIcons, onChoose }: Props) {
  const [selectBgFailed, setSelectBgFailed] = useState(false)
  const reducedMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  )
  const owned = new Set(ownedIds)

  // One pick per rebirth: a double-click / held Enter / a second row inside the confirm flash is refused.
  const choice = useRef<RebirthChoiceState>(REBIRTH_CHOICE_IDLE)
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  // Warm the six keyframes while the player is reading the rows, so the ceremony never opens on a blank frame.
  useEffect(() => {
    const warm = () => rebirthKeyframePreloadOrder().forEach((file) => { new Image().src = `/clicker/rebirth/${file}` })
    const idle = window.requestIdleCallback
    if (idle) {
      const id = idle(warm, { timeout: 1500 })
      return () => window.cancelIdleCallback?.(id)
    }
    const id = window.setTimeout(warm, 300)
    return () => window.clearTimeout(id)
  }, [])

  const choose = (buff: TranscendenceDef) => {
    const pick = pickRebirthWorldline(choice.current, buff.id, ownedIds, buffs.map((b) => b.id))
    if (!pick.accepted) return
    choice.current = pick.state
    const delay = rebirthConfirmDelayMs(reducedMotion)
    if (delay <= 0) {
      onChoose(buff)
      return
    }
    timer.current = window.setTimeout(() => onChoose(buff), delay)
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
