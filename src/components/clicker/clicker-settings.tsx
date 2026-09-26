"use client"

import { useEffect, useRef, useState } from "react"
import { useClickerDialogFocus, useClickerEscape } from "@/components/clicker/clicker-a11y"

type Props = {
  muted: boolean
  onToggleMute: () => void
  adminEnabled: boolean
  onToggleAdmin: () => void
  onClose: () => void
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setReduced(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])
  return reduced
}

/** Settings sheet — SFX persists in the save; motion mirrors the OS. */
export function ClickerSettings({
  muted,
  onToggleMute,
  adminEnabled,
  onToggleAdmin,
  onClose,
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const reducedMotion = useReducedMotion()
  useClickerDialogFocus(rootRef)
  useClickerEscape(true, onClose)

  return (
    <div className="clicker-settings-backdrop" onClick={onClose}>
      <aside
        ref={rootRef}
        className="clicker-settings"
        role="dialog"
        aria-modal="true"
        aria-labelledby="clicker-settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="clicker-settings-head">
          <div>
            <p className="clicker-settings-kicker">AURELIA · 환경설정</p>
            <h2 id="clicker-settings-title">설정</h2>
          </div>
          <button type="button" className="clicker-ghost" onClick={onClose} aria-keyshortcuts="Escape">
            닫기 · Esc
          </button>
        </header>

        <ul className="clicker-settings-list">
          <li className="clicker-settings-row">
            <div className="clicker-settings-copy">
              <strong>효과음</strong>
              <p>레이저·환생 등 짧은 피드백 사운드.</p>
            </div>
            <button
              type="button"
              className={`clicker-settings-toggle${muted ? "" : " is-on"}`}
              aria-pressed={!muted}
              aria-label={muted ? "효과음 꺼짐 — 켜려면 탭" : "효과음 켜짐 — 끄려면 탭"}
              onClick={onToggleMute}
            >
              {muted ? "꺼짐" : "켜짐"}
            </button>
          </li>
          <li className="clicker-settings-row">
            <div className="clicker-settings-copy">
              <strong>관리자 모드</strong>
              <p>화면 구석에 관리자 버튼이 생깁니다. CORE 지급·해금 등 치트는 이 브라우저 세이브에만 적용됩니다.</p>
            </div>
            <button
              type="button"
              className={`clicker-settings-toggle${adminEnabled ? " is-on" : ""}`}
              aria-pressed={adminEnabled}
              aria-label={adminEnabled ? "관리자 모드 켜짐 — 끄려면 탭" : "관리자 모드 꺼짐 — 켜려면 탭"}
              onClick={onToggleAdmin}
            >
              {adminEnabled ? "켜짐" : "꺼짐"}
            </button>
          </li>
          <li className="clicker-settings-row">
            <div className="clicker-settings-copy">
              <strong>움직임 줄이기</strong>
              <p>시스템 접근성 설정을 따릅니다.</p>
            </div>
            <span className={`clicker-settings-status${reducedMotion ? " is-on" : ""}`}>
              {reducedMotion ? "사용 중" : "기본"}
            </span>
          </li>
        </ul>
      </aside>
    </div>
  )
}
