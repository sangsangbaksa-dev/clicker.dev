"use client"

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { RebirthPhaseArt } from "@/data/clicker/rebirth-assets"
import { rebirthVariantFor } from "@/data/clicker/rebirth-motion"
import type { TranscendenceDef } from "@/application/clicker-ui"
import { useArmedPress, useClickerDialogFocus, useClickerEscape } from "@/components/clicker/clicker-a11y"
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

/** What a rebirth wipes and what it carries, shown before the player commits. */
const RESETS = ["CORE와 누적 CORE", "생산자·업그레이드", "이번 런의 스킬 회로", "지역 재화·장비·물약"]
const KEEPS = ["걸은 세계선과 그 효과", "환생 보너스(채굴·생산 배율)", "유물·업적"]

const art = (buff: TranscendenceDef) => RebirthPhaseArt.stampFor(buff.id) ?? buff.assetId
const tint = (buff: TranscendenceDef) => {
  const v = rebirthVariantFor(buff.id)
  return { "--wl-primary": v.primary, "--wl-accent": v.accent } as CSSProperties
}

/**
 * Worldline picker: one card per worldline (still-open ones first, walked ones after), and a
 * confirm sheet that says exactly what the rebirth resets and keeps before it starts.
 */
export function ClickerRebirthWorldlineSelect({ buffs, ownedIds, popIcons, locked = false, onChoose }: Props) {
  const [confirming, setConfirming] = useState<TranscendenceDef | null>(null)
  const owned = useMemo(() => new Set(ownedIds), [ownedIds])
  const ordered = useMemo(() => [...buffs].sort((a, b) => Number(owned.has(a.id)) - Number(owned.has(b.id))), [buffs, owned])

  // Warm every worldline's rebirth plates while the player is still choosing.
  useEffect(() => {
    if (locked) return
    for (const b of buffs) preloadRebirthArt(b.id)
  }, [buffs, locked])

  return (
    <div className={`clicker-wl-select${locked ? " is-locked" : ""}`}>
      <ul className="clicker-wl-list">
        {ordered.map((buff) => {
          const walked = owned.has(buff.id)
          return (
            <li
              key={buff.id}
              className={`clicker-wl-card${walked ? " is-walked" : ""}${(popIcons[buff.id] ?? 0) > 0 ? " is-pop-icon" : ""}`}
              style={tint(buff)}
            >
              <img className="clicker-wl-stamp" src={art(buff)} alt="" />
              <div className="clicker-wl-copy">
                <strong>{buff.name}</strong>
                <span className="clicker-wl-identity">{buff.identity}</span>
                <p>{buff.description}</p>
              </div>
              {walked ? (
                <span className="clicker-wl-chip">완료</span>
              ) : (
                <button
                  type="button"
                  className="clicker-primary clicker-wl-go"
                  disabled={locked}
                  aria-label={locked ? `${buff.name} · 환생 목표를 채우면 선택 가능` : `${buff.name} 세계선으로 환생`}
                  onClick={() => setConfirming(buff)}
                >
                  {locked ? "잠김" : "환생"}
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {confirming ? (
        <RebirthConfirm
          buff={confirming}
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            const chosen = confirming
            setConfirming(null)
            onChoose(chosen)
          }}
        />
      ) : null}
    </div>
  )
}

function RebirthConfirm({ buff, onCancel, onConfirm }: { buff: TranscendenceDef; onCancel: () => void; onConfirm: () => void }) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  useClickerDialogFocus(rootRef)
  useClickerEscape(true, onCancel)
  // The confirm button appears where the card's button was tapped: ignore an accidental double tap.
  const armedPress = useArmedPress(buff.id)
  return (
    <div className="clicker-wl-confirm-backdrop" onClick={onCancel}>
      <div
        ref={rootRef}
        className="clicker-wl-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="clicker-wl-confirm-title"
        style={tint(buff)}
        onClick={(e) => e.stopPropagation()}
      >
        <img className="clicker-wl-confirm-stamp" src={art(buff)} alt="" />
        <p className="clicker-wl-confirm-kicker">WORLD LINE · 환생</p>
        <h3 id="clicker-wl-confirm-title">{buff.name}</h3>
        <p className="clicker-wl-confirm-effect">{buff.description}</p>
        <div className="clicker-wl-confirm-lists">
          <div>
            <h4>초기화</h4>
            <ul>
              {RESETS.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
          <div className="is-keep">
            <h4>유지</h4>
            <ul>
              {KEEPS.map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="clicker-wl-confirm-actions">
          <button type="button" className="clicker-ghost" onClick={onCancel}>
            취소 · Esc
          </button>
          <button type="button" className="clicker-primary" autoFocus onClick={armedPress(onConfirm)}>
            환생 시작
          </button>
        </div>
      </div>
    </div>
  )
}
