"use client"

import { useClickerUiLang } from "@/hooks/use-clicker-ui-lang"

type Props = {
  bgSrc: string
  label?: string
  sub?: string
  hint?: string
}

const FALLBACK_BG = "/clicker/bg/loading_core_awakening.webp"

/** Only same-origin clicker image paths — blocks CSS url() injection via bgSrc. */
function safeClickerBg(src: string): string {
  if (/^\/clicker\/[A-Za-z0-9_./-]+\.(webp|png|jpe?g|gif)$/i.test(src)) return src
  return FALLBACK_BG
}

/** Boot / save-load screen with a frosted panel and indeterminate shimmer bar. */
export function ClickerLoading({
  bgSrc,
  label = "CORE를 깨우는 중…",
  sub = "세이브 불러오는 중",
  hint = "자동 저장 키는 그대로 유지됩니다",
}: Props) {
  const [uiLang] = useClickerUiLang()
  const safeBg = safeClickerBg(bgSrc)
  return (
    <div
      data-clicker
      className="clicker-shell clicker-loading"
      role="status"
      aria-busy="true"
      aria-live="polite"
      lang={uiLang}
    >
      <div className="clicker-loading-bg" style={{ backgroundImage: `url("${safeBg}")` }} aria-hidden />
      <div className="clicker-loading-panel">
        <p className="clicker-loading-text">{label}</p>
        <div
          className="clicker-loading-bar"
          role="progressbar"
          aria-label="로딩 중"
          aria-valuetext="로딩 중"
        >
          <i className="clicker-loading-bar-shimmer" aria-hidden />
        </div>
        <p className="clicker-loading-sub">{sub}</p>
        <p className="clicker-loading-hint">{hint}</p>
      </div>
    </div>
  )
}
