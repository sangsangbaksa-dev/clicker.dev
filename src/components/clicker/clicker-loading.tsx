type Props = {
  bgSrc: string
  label?: string
}

/** Boot / save-load screen with a frosted panel and indeterminate shimmer bar. */
export function ClickerLoading({ bgSrc, label = "CORE를 깨우는 중…" }: Props) {
  return (
    <div data-clicker className="clicker-shell clicker-loading" role="status" aria-busy="true" aria-live="polite">
      <div className="clicker-loading-bg" style={{ backgroundImage: `url(${bgSrc})` }} aria-hidden />
      <div className="clicker-loading-panel">
        <p className="clicker-loading-text">{label}</p>
        <div className="clicker-loading-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-label="로딩 중">
          <i className="clicker-loading-bar-shimmer" aria-hidden />
        </div>
      </div>
    </div>
  )
}
