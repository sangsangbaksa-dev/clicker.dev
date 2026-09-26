"use client"

import { useEffect, useRef, useState } from "react"
import { CLICKER_ASSETS } from "@/data/clicker/catalog"
import { CLICKER_TRUE_ENDING_STEPS } from "@/data/clicker/ending"
import { useClickerDialogFocus, useClickerEscape } from "@/components/clicker/clicker-a11y"

export type EndingSummary = {
  worldlinesOwned: number
  worldlinesTotal: number
  rebirthCount: number
  lifetimeCoreText: string
}

type Props = {
  onComplete: () => void
  onCancel: () => void
  summary?: EndingSummary
}

export function ClickerEnding({ onComplete, onCancel, summary }: Props) {
  const [step, setStep] = useState(0)
  const [confirmRun, setConfirmRun] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const current = CLICKER_TRUE_ENDING_STEPS[step]
  const last = step >= CLICKER_TRUE_ENDING_STEPS.length - 1

  useClickerDialogFocus(rootRef)

  useEffect(() => {
    if (!confirmRun) return
    const timer = window.setTimeout(() => setConfirmRun(false), 8000)
    return () => window.clearTimeout(timer)
  }, [confirmRun])

  const goBack = () => {
    setConfirmRun(false)
    if (step <= 0) {
      onCancel()
      return
    }
    setStep((s) => Math.max(0, s - 1))
  }

  useClickerEscape(true, () => {
    if (last && confirmRun) {
      setConfirmRun(false)
      return
    }
    goBack()
  })

  return (
    <div
      ref={rootRef}
      className="clicker-ending-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="clicker-ending-title"
    >
      <article className="clicker-ending">
        <header className="clicker-ending-head">
          <img src={CLICKER_ASSETS.luma} alt="" width={56} height={56} />
          <div>
            <div className="clicker-ending-kicker">
              AURELIA Protocol · {step + 1}/{CLICKER_TRUE_ENDING_STEPS.length}
            </div>
            <h2 id="clicker-ending-title">{current.title}</h2>
            {current.accent ? <p className="clicker-ending-accent">{current.accent}</p> : null}
          </div>
        </header>
        <p className="clicker-ending-body">{current.body}</p>
        {last && summary ? (
          <dl className="clicker-ending-summary" aria-label="기록 요약">
            <div>
              <dt>세계선</dt>
              <dd>
                {summary.worldlinesOwned}/{summary.worldlinesTotal}
              </dd>
            </div>
            <div>
              <dt>환생</dt>
              <dd>{summary.rebirthCount}</dd>
            </div>
            <div>
              <dt>누적 CORE</dt>
              <dd>{summary.lifetimeCoreText}</dd>
            </div>
          </dl>
        ) : null}
        {last ? (
          <p className="clicker-ending-warn">
            {confirmRun
              ? "Protocol을 실행하면 이 기록은 닫히고 채굴·상점·환생을 더 이상 진행할 수 없습니다. (8초 후 확인 취소)"
              : "실행 전 요약을 확인하세요. 계속 플레이하려면 아래 보조 버튼으로 돌아갈 수 있습니다."}
          </p>
        ) : null}
        <div className="clicker-ending-dots" aria-hidden>
          {CLICKER_TRUE_ENDING_STEPS.map((s, i) => (
            <span key={s.id} className={i === step ? "is-active" : ""} />
          ))}
        </div>
        <footer className="clicker-ending-foot">
          <button type="button" className="clicker-ghost" aria-keyshortcuts="Escape" onClick={last && confirmRun ? () => setConfirmRun(false) : goBack}>
            {last && confirmRun ? "한 단계 뒤로" : step <= 0 ? "계속 플레이" : "이전"}
            {(last && confirmRun) || step <= 0 ? <span className="clicker-key-hint"> · Esc</span> : null}
          </button>
          {last ? (
            confirmRun ? (
              <button
                type="button"
                className="clicker-danger"
                aria-label="Protocol 실행 — 기록을 닫고 채굴을 종료합니다"
                onClick={onComplete}
              >
                Protocol 실행 · 기록 닫기
              </button>
            ) : (
              <button type="button" className="clicker-primary" onClick={() => setConfirmRun(true)}>
                실행 확인
              </button>
            )
          ) : (
            <button
              type="button"
              className="clicker-primary"
              aria-label={`다음 단계 · ${step + 2}/${CLICKER_TRUE_ENDING_STEPS.length}`}
              onClick={() => setStep((s) => s + 1)}
            >
              다음
            </button>
          )}
        </footer>
      </article>
    </div>
  )
}
