"use client"

import { useState } from "react"
import { CLICKER_TUTORIAL_STEPS } from "@/data/clicker/onboarding"
import { useClickerEscape } from "@/components/clicker/clicker-a11y"

/** Story beats and play tips, once per save (and again after a reset). */
export function ClickerTutorial({ onDone, hidden = false }: { onDone: () => void; hidden?: boolean }) {
  // Stays mounted while hidden (a mine run mid-tutorial) so it resumes on the same step.
  const [step, setStep] = useState(0)
  useClickerEscape(!hidden, onDone)
  const current = CLICKER_TUTORIAL_STEPS[step]
  const last = step >= CLICKER_TUTORIAL_STEPS.length - 1
  if (hidden) return null
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
