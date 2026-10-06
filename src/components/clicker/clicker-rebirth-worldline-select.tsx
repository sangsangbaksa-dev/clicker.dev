"use client"

import { useEffect, useMemo, useState } from "react"
import { CLICKER_ASSETS } from "@/data/clicker/catalog"
import { RebirthPhaseArt } from "@/data/clicker/rebirth-assets"
import type { TranscendenceDef } from "@/application/clicker-ui"
import { preloadRebirthArt } from "@/components/clicker/clicker-rebirth-motion"
import "./clicker-rebirth-worldline-select.css"

type Props = {
  buffs: TranscendenceDef[]
  ownedIds: readonly string[]
  popIcons: Record<string, number>
  /** Preview before rebirth opens: every row is shown, no button can be pressed. */
  locked?: boolean
  onChoose: (buff: TranscendenceDef) => void
}

/** A rebirth cannot be undone: the first press arms the row, a second press within this window confirms. */
const ARM_WINDOW_MS = 3000

const SELECT_CONFIRM_MS = 180
const SELECT_CONFIRM_REDUCED_MS = 0

/** Every worldline is one row: icon, name, identity, effect, and the rebirth button. */
export function ClickerRebirthWorldlineSelect({ buffs, ownedIds, popIcons, locked = false, onChoose }: Props) {
  const [selectBgFailed, setSelectBgFailed] = useState(false)
  const [armedId, setArmedId] = useState<string | null>(null)
  useEffect(() => {
    if (!armedId) return
    const t = window.setTimeout(() => setArmedId(null), ARM_WINDOW_MS)
    return () => window.clearTimeout(t)
  }, [armedId])
  const reducedMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  )
  // Warm every worldline's rebirth plates while the player is still choosing.
  useEffect(() => {
    if (locked) return
    for (const b of buffs) preloadRebirthArt(b.id)
  }, [buffs, locked])
  const owned = new Set(ownedIds)

  const choose = (buff: TranscendenceDef) => {
    if (armedId !== buff.id) {
      setArmedId(buff.id)
      return
    }
    setArmedId(null)
    const delay = reducedMotion ? SELECT_CONFIRM_REDUCED_MS : SELECT_CONFIRM_MS
    if (delay <= 0) {
      onChoose(buff)
      return
    }
    window.setTimeout(() => onChoose(buff), delay)
  }

  return (
    <div className={`clicker-wl-select${reducedMotion ? " is-reduced" : ""}${locked ? " is-locked" : ""}`}>
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
                  className={`clicker-primary${armedId === buff.id ? " is-armed" : ""}`}
                  disabled={walked || locked}
                  aria-label={
                    walked
                      ? `${buff.name} · 이미 걸은 세계선`
                      : locked
                        ? `${buff.name} · 환생 목표를 채우면 선택 가능`
                        : armedId === buff.id
                          ? `${buff.name} · 다시 눌러 환생 확정`
                          : `${buff.name} · 환생하기`
                  }
                  onClick={() => choose(buff)}
                >
                  {walked ? "완료" : locked ? "잠김" : armedId === buff.id ? "정말 환생 · 다시 누르기" : "환생하기"}
                </button>
              </article>
            )
        })}
      </div>
    </div>
  )
}
