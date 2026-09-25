"use client"

import { useMemo, useState, type CSSProperties } from "react"
import { CLICKER_ASSETS } from "@/data/clicker/catalog"
import {
  REBIRTH_CHROME_WORLDLINE_IDS,
  RebirthPhaseArt,
} from "@/data/clicker/rebirth-assets"
import { rebirthVariantFor } from "@/data/clicker/rebirth-motion"
import type { TranscendenceDef } from "@/domain/entities/clicker"
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
      <img src={CLICKER_ASSETS.bgTranscendence} alt="" className="clicker-wl-select-room-bg" aria-hidden />
      {!chromeFailed ? (
        <img
          src={RebirthPhaseArt.selectChromeShared}
          alt=""
          className="clicker-wl-select-chrome-bg"
          onError={() => setChromeFailed(true)}
        />
      ) : null}
      <p className="clicker-wl-select-note">
        {reducedMotion
          ? "선택하면 재탄생이 바로 시작됩니다. 이번 런의 생산·채굴은 초기화되며 버프는 영구입니다. Esc로 연출을 건너뛸 수 있습니다."
          : "선택 즉시 재탄생 연출이 시작되며, 이번 런의 생산·채굴은 초기화됩니다. 버프는 영구 · Esc로 연출 건너뛰기."}
      </p>
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
              onMouseEnter={() => setFocusId(buff.id)}
              onFocus={() => setFocusId(buff.id)}
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
                  {walked ? <em className="clicker-wl-walked">기억됨</em> : null}
                </strong>
                <p>{buff.identity}</p>
                <small>{buff.description}</small>
              </div>
              <button
                type="button"
                className="clicker-primary"
                aria-label={walked ? `${buff.name} · 기억된 선 — 다시 접기` : `${buff.name} · 이 선으로 접기`}
                onClick={() => choose(buff)}
              >
                {walked ? "다시 이 선으로" : "이 선으로 접기"}
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
                    {walked ? <em className="clicker-wl-walked">기억됨</em> : null}
                  </strong>
                  <div style={{ color: "var(--text-2)", fontSize: 12 }}>{buff.identity}</div>
                  <div style={{ fontSize: 12 }}>{buff.description}</div>
                </div>
                <button
                  type="button"
                  className="clicker-primary"
                  aria-label={walked ? `${buff.name} · 기억된 선 — 다시 접기` : `${buff.name} · 이 선으로 접기`}
                  onClick={() => choose(buff)}
                >
                  {walked ? "다시 이 선으로" : "이 선으로 접기"}
                </button>
              </article>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
