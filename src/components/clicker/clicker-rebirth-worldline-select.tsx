"use client"

import { useMemo, useState, type CSSProperties } from "react"
import { CLICKER_ASSETS } from "@/data/clicker/catalog"
import {
  REBIRTH_CHROME_WORLDLINE_IDS,
  RebirthPhaseArt,
} from "@/data/clicker/rebirth-assets"
import { rebirthVariantFor } from "@/data/clicker/rebirth-motion"
import { playSfx } from "@/lib/clicker-sfx"
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

/** Wave A stamp plate when present; geometric motif only as last-resort fallback. */
function WorldlineStampArt({
  transcendenceId,
  motif,
  fallbackAssetId,
}: {
  transcendenceId: string
  motif: ReturnType<typeof rebirthVariantFor>["motif"]
  fallbackAssetId: string
}) {
  const stampSrc = RebirthPhaseArt.stampFor(transcendenceId)
  if (stampSrc) {
    return (
      <div className="clicker-wl-chrome-art clicker-wl-chrome-art--stamp">
        <img src={stampSrc} alt="" className="clicker-wl-chrome-stamp" />
      </div>
    )
  }
  return (
    <div className="clicker-wl-chrome-art">
      <img src={fallbackAssetId} alt="" />
      <span className={`clicker-wl-chrome-motif clicker-wl-chrome-motif--${motif}`} aria-hidden />
    </div>
  )
}

export function ClickerRebirthWorldlineSelect({ buffs, ownedIds, popIcons, onChoose }: Props) {
  const [chromeFailed, setChromeFailed] = useState(false)
  const [selectBgFailed, setSelectBgFailed] = useState(false)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const reducedMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  )
  const owned = new Set(ownedIds)
  const chromeBuffs = buffs.filter((b) => (REBIRTH_CHROME_WORLDLINE_IDS as readonly string[]).includes(b.id))
  const extraBuffs = buffs.filter((b) => !(REBIRTH_CHROME_WORLDLINE_IDS as readonly string[]).includes(b.id))

  const choose = (buff: TranscendenceDef) => {
    setConfirmId(buff.id)
    setFocusId(buff.id)
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
      {!chromeFailed ? (
        <img
          src={RebirthPhaseArt.selectChromeShared}
          alt=""
          className="clicker-wl-select-chrome-bg"
          onError={() => setChromeFailed(true)}
        />
      ) : null}
      <div className="clicker-wl-select-grid">
        {chromeBuffs.map((buff) => {
          const variant = rebirthVariantFor(buff.id)
          const walked = owned.has(buff.id)
          const focused = focusId === buff.id
          const confirming = confirmId === buff.id
          return (
            <article
              key={buff.id}
              className={`clicker-wl-chrome-card${(popIcons[buff.id] ?? 0) > 0 ? " is-pop-icon" : ""}${walked ? " is-walked" : ""}${focused ? " is-focus" : ""}${confirming ? " is-confirm" : ""}`}
              style={
                {
                  "--wl-primary": variant.primary,
                  "--wl-accent": variant.accent,
                } as CSSProperties
              }
              onMouseEnter={() => {
                if (focusId !== buff.id) playSfx("worldlineHover")
                setFocusId(buff.id)
              }}
              onFocus={() => {
                if (focusId !== buff.id) playSfx("worldlineHover")
                setFocusId(buff.id)
              }}
            >
              {focused && !confirming ? (
                <img src={RebirthPhaseArt.selectFocus} alt="" className="clicker-wl-select-focus-plate" aria-hidden />
              ) : null}
              {walked ? (
                <img src={RebirthPhaseArt.selectLocked} alt="" className="clicker-wl-select-locked-plate" aria-hidden />
              ) : null}
              {confirming && !reducedMotion ? (
                <img
                  src={RebirthPhaseArt.selectConfirmFlash}
                  alt=""
                  className="clicker-wl-select-confirm-flash"
                  aria-hidden
                />
              ) : null}
              <WorldlineStampArt
                transcendenceId={buff.id}
                motif={variant.motif}
                fallbackAssetId={buff.assetId}
              />
              <div className="clicker-wl-chrome-body">
                <strong>
                  {buff.name}
                  {walked ? <em className="clicker-wl-walked">완료</em> : null}
                </strong>
                <p>{buff.identity}</p>
                <small>{buff.description}</small>
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
      {extraBuffs.length > 0 ? (
        <div className="clicker-wl-select-extra">
          {extraBuffs.map((buff) => {
            const walked = owned.has(buff.id)
            return (
              <article
                key={buff.id}
                className={`clicker-card clicker-wl-extra-card${(popIcons[buff.id] ?? 0) > 0 ? " is-pop-icon" : ""}${walked ? " is-walked" : ""}`}
              >
                <img src={buff.assetId} alt="" />
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
      ) : null}
    </div>
  )
}
