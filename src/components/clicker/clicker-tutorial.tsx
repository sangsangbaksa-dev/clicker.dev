"use client"

import { useState } from "react"
import { CLICKER_TUTORIAL_STEPS } from "@/data/clicker/onboarding"
import { clampTutorialStep } from "@/application/clicker-ui"
import { useClickerEscape } from "@/components/clicker/clicker-a11y"

/** Story beats and play tips, once per save (and again after a reset). */
export function ClickerTutorial({ onDone, admin = false }: { onDone: () => void; admin?: boolean }) {
  const [step, setStep] = useState(0)
  useClickerEscape(true, onDone)
  const current = CLICKER_TUTORIAL_STEPS[step]
  const last = step >= CLICKER_TUTORIAL_STEPS.length - 1
  return (
    <div className={`clicker-tutorial${current.bgAssetId ? " is-story" : ""}`} role="dialog" aria-modal="true" aria-labelledby="clicker-tutorial-title">
      {current.bgAssetId ? (
        <div className="clicker-tutorial-bg" key={current.id} style={{ backgroundImage: `url(${current.bgAssetId})` }} aria-hidden />
      ) : null}
      <div className="clicker-tutorial-card" key={`card-${current.id}`}>
        <p className="clicker-tutorial-kicker">
          {current.bgAssetId ? "STORY" : "TUTORIAL"} · {step + 1}/{CLICKER_TUTORIAL_STEPS.length}
        </p>
        <h2 id="clicker-tutorial-title">{current.title}</h2>
        <p>{current.body}</p>
        {admin ? (
          <div className="clicker-tutorial-admin" aria-label="관리자 · 튜토리얼 단계 이동">
            <button type="button" className="clicker-ghost" onClick={() => setStep((n) => clampTutorialStep(n - 1, CLICKER_TUTORIAL_STEPS.length))}>
              ◀
            </button>
            {CLICKER_TUTORIAL_STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                className={`clicker-ghost${i === step ? " is-on" : ""}`}
                aria-label={`단계 ${i + 1}로 이동`}
                onClick={() => setStep(clampTutorialStep(i, CLICKER_TUTORIAL_STEPS.length))}
              >
                {i + 1}
              </button>
            ))}
            <button type="button" className="clicker-ghost" onClick={() => setStep((n) => clampTutorialStep(n + 1, CLICKER_TUTORIAL_STEPS.length))}>
              ▶
            </button>
          </div>
        ) : null}
        <div className="clicker-tutorial-actions">
          <button type="button" className="clicker-ghost" onClick={onDone}>
            건너뛰기
          </button>
          <button type="button" className="clicker-primary" autoFocus onClick={() => (last ? onDone() : setStep(step + 1))}>
            {last ? "시작" : "다음"}
          </button>
        </div>
      </div>
    </div>
  )
}
