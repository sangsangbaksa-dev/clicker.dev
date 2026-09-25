"use client"

import { CLICKER_ASSETS } from "@/data/clicker/catalog"

type Props = {
  muted: boolean
  onToggleMute: () => void
  onStart: () => void
}

/** Title gate: start lands on upgrades hub; timed mine opens from hub Enter Mine. */
export function ClickerTitle({ muted, onToggleMute, onStart }: Props) {
  return (
    <div
      className="clicker-title"
      role="dialog"
      aria-labelledby="clicker-title-brand"
      aria-describedby="clicker-title-lead"
    >
      <div
        className="clicker-title-bg"
        style={{ backgroundImage: `url(${CLICKER_ASSETS.bgMineEntrance})` }}
        aria-hidden
      >
        {/* Starts on the same still as the background, so a slow or failed load shows no seam. */}
        <video
          className="clicker-title-bg-video"
          src={CLICKER_ASSETS.titleLoop}
          poster={CLICKER_ASSETS.bgMineEntrance}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        />
      </div>
      <div className="clicker-title-veil" aria-hidden />
      <div className="clicker-title-grain" aria-hidden />
      <button
        type="button"
        className={`clicker-ghost clicker-title-mute${muted ? " is-muted" : ""}`}
        aria-pressed={muted}
        aria-label={muted ? "효과음 꺼짐 — 켜려면 탭" : "효과음 켜짐 — 끄려면 탭"}
        title="효과음 · 세이브에 저장"
        onClick={onToggleMute}
      >
        {muted ? "음소거" : "효과음"}
      </button>
      <div className="clicker-title-copy">
        <p className="clicker-title-kicker">WORLD LINE PROTOCOL</p>
        <h1 id="clicker-title-brand" className="clicker-title-brand">
          AURELIA CORE
        </h1>
        <p id="clicker-title-lead" className="clicker-title-lead">
          코어를 깨우고 업그레이드를 쌓은 뒤, 허브에서 Enter Mine으로 채굴 세션을 엽니다.
        </p>
        <div className="clicker-title-cta">
          <button
            type="button"
            className="clicker-primary clicker-title-start"
            onClick={onStart}
            autoFocus
            aria-label="시작하기 — 업그레이드 허브로"
          >
            시작하기
          </button>
          <span className="clicker-title-cta-hint">
            {muted ? "허브 → Enter Mine · muted" : "허브 → Enter Mine"}
          </span>
        </div>
      </div>
    </div>
  )
}
