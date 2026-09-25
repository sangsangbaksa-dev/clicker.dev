"use client"

import { useEffect, useRef, useState } from "react"
import { useClickerDialogFocus, useClickerEscape } from "@/components/clicker/clicker-a11y"

type Props = {
  muted: boolean
  musicMuted: boolean
  musicVolume: number
  onToggleMute: () => void
  onToggleMusic: () => void
  onMusicVolume: (volume: number) => void
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

/** Settings sheet — SFX, music and volume persist in the save; motion mirrors the OS. */
export function ClickerSettings({
  muted,
  musicMuted,
  musicVolume,
  onToggleMute,
  onToggleMusic,
  onMusicVolume,
  onClose,
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const reducedMotion = useReducedMotion()
  useClickerDialogFocus(rootRef)
  useClickerEscape(true, onClose)
  const volumePct = Math.round(musicVolume * 100)

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
              <strong>배경음악</strong>
              <p>허브·광산·환생 장면마다 곡이 바뀌며 부드럽게 전환됩니다.</p>
            </div>
            <button
              type="button"
              className={`clicker-settings-toggle${musicMuted ? "" : " is-on"}`}
              aria-pressed={!musicMuted}
              aria-label={musicMuted ? "배경음악 꺼짐 — 켜려면 탭" : "배경음악 켜짐 — 끄려면 탭"}
              onClick={onToggleMusic}
            >
              {musicMuted ? "꺼짐" : "켜짐"}
            </button>
          </li>
          <li className="clicker-settings-row">
            <label className="clicker-settings-copy" htmlFor="clicker-music-volume">
              <strong>음악 볼륨</strong>
              <p>{musicMuted ? "배경음악이 꺼져 있습니다." : `${volumePct}%`}</p>
            </label>
            <input
              id="clicker-music-volume"
              className="clicker-settings-range"
              type="range"
              min={0}
              max={100}
              step={5}
              value={volumePct}
              disabled={musicMuted}
              onChange={(e) => onMusicVolume(Number(e.target.value) / 100)}
            />
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
