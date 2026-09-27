"use client"

import { useRef, useState } from "react"
import { CLICKER_TRUE_ENDING_STEPS } from "@/data/clicker/ending"
import { useArmedPress, useClickerDialogFocus } from "@/components/clicker/clicker-a11y"

export type EndingSummary = {
  worldlinesOwned: number
  worldlinesTotal: number
  rebirthCount: number
  lifetimeCoreText: string
}

type Props = {
  onComplete: () => void
  summary?: EndingSummary
}

/** Ending story cards after the ending videos; the last card seals the record. */
export function ClickerEnding({ onComplete, summary }: Props) {
  const [step, setStep] = useState(0)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const current = CLICKER_TRUE_ENDING_STEPS[step]
  const last = step >= CLICKER_TRUE_ENDING_STEPS.length - 1
  useClickerDialogFocus(rootRef)
  // "다음" and "완료" sit in the same spot: a fast double-click through the story must not seal the record.
  const armedPress = useArmedPress(String(step))

  return (
    <div ref={rootRef} className="clicker-ending-backdrop" role="dialog" aria-modal="true" aria-labelledby="clicker-ending-title">
      <article className="clicker-ending">
        <header className="clicker-ending-head">
          <div>
            <div className="clicker-ending-kicker">
              ENDING · {step + 1}/{CLICKER_TRUE_ENDING_STEPS.length}
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
        <div className="clicker-ending-dots" aria-hidden>
          {CLICKER_TRUE_ENDING_STEPS.map((s, i) => (
            <span key={s.id} className={i === step ? "is-active" : ""} />
          ))}
        </div>
        <footer className="clicker-ending-foot">
          <button type="button" className="clicker-primary" autoFocus onClick={last ? armedPress(onComplete) : () => setStep(step + 1)}>
            {last ? "완료" : "다음"}
          </button>
        </footer>
      </article>
    </div>
  )
}
