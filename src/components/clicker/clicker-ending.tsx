"use client"

import { useEffect, useRef, useState } from "react"
import { CLICKER_TRUE_ENDING_STEPS } from "@/data/clicker/ending"
import { clickerElapsedPlayTimeMs, formatClickerPlayTime } from "@/application/clicker-ui"
import { useArmedPress, useClickerDialogFocus } from "@/components/clicker/clicker-a11y"

export type EndingSummary = {
  worldlinesOwned: number
  worldlinesTotal: number
  rebirthCount: number
  lifetimeCoreText: string
  /** First start of this save; null for old saves (no play time then). */
  startedAt: number | null
  clicksText: string
  monstersSlain: number
  /** Names of the worldlines walked, in the order they were taken. */
  worldlineNames: string[]
}

type Props = {
  onComplete: () => void
  summary?: EndingSummary
}

/** Each beat holds this long before the "다음" button lights up (the text is still revealing). */
const BEAT_SETTLE_MS = 1400

/**
 * The true ending as a short full-screen sequence: every beat has its own painted backdrop
 * with a slow camera drift and a crossfade, the narration fades in line by line, the
 * worldline beat lists the lines the player actually walked, and the last beat is the
 * record (play time, CORE, rebirths …). "완료" on that beat seals the run.
 */
export function ClickerEnding({ onComplete, summary }: Props) {
  const [step, setStep] = useState(0)
  const [settled, setSettled] = useState(false)
  // Play time is taken once, when the ending opens: start → the guardian's fall.
  const [openedAt] = useState(() => Date.now())
  const playMs = summary ? clickerElapsedPlayTimeMs({ startedAt: summary.startedAt, completedAt: null }, openedAt) : null
  const rootRef = useRef<HTMLDivElement | null>(null)
  const current = CLICKER_TRUE_ENDING_STEPS[step]
  const last = step >= CLICKER_TRUE_ENDING_STEPS.length - 1
  useClickerDialogFocus(rootRef)
  // "다음" and "완료" sit in the same spot: a fast double-click through the story must not seal the record.
  const armedPress = useArmedPress(String(step))

  // Warm every backdrop up front so a beat change never waits on the network.
  useEffect(() => {
    for (const s of CLICKER_TRUE_ENDING_STEPS) {
      const img = new Image()
      img.src = s.backdrop
    }
  }, [])

  useEffect(() => {
    setSettled(false)
    const t = window.setTimeout(() => setSettled(true), BEAT_SETTLE_MS)
    return () => window.clearTimeout(t)
  }, [step])

  const next = () => (last ? undefined : setStep((s) => Math.min(s + 1, CLICKER_TRUE_ENDING_STEPS.length - 1)))

  return (
    <div
      ref={rootRef}
      className={`clicker-ending-backdrop is-${current.id}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="clicker-ending-title"
      onClick={(e) => {
        // A tap on the picture (not the card) moves the story on, once the beat has landed.
        if (settled && !last && e.target === e.currentTarget) next()
      }}
    >
      <div className="clicker-ending-stage" aria-hidden>
        {CLICKER_TRUE_ENDING_STEPS.map((s, i) => (
          <img
            key={s.id}
            src={s.backdrop}
            alt=""
            className={`clicker-ending-plate${i === step ? " is-on" : ""}${i < step ? " is-past" : ""}`}
            decoding="async"
          />
        ))}
        <svg className="clicker-ending-constellation" viewBox="0 0 1200 900" preserveAspectRatio="xMidYMid slice">
          <defs>
            <radialGradient id="ending-core-light">
              <stop stopColor="#fff7cf" stopOpacity=".95" />
              <stop offset=".3" stopColor="#ffd47a" stopOpacity=".48" />
              <stop offset="1" stopColor="#80dfff" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="ending-orbit-light">
              <stop stopColor="#8be8ff" stopOpacity="0" />
              <stop offset=".48" stopColor="#b9f2ff" stopOpacity=".72" />
              <stop offset="1" stopColor="#ffd98b" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g className="clicker-ending-rays">
            <path d="M600 390 600 25M600 390 880 88M600 390 1118 250M600 390 1150 520M600 390 900 810M600 390 600 880M600 390 290 808M600 390 55 570M600 390 100 200M600 390 340 60" />
          </g>
          <g className="clicker-ending-orbit clicker-ending-orbit-a">
            <ellipse cx="600" cy="390" rx="300" ry="92" />
            <path d="M316 325Q600 225 884 325" />
          </g>
          <g className="clicker-ending-orbit clicker-ending-orbit-b">
            <ellipse cx="600" cy="390" rx="220" ry="142" />
            <path d="M420 515Q600 570 780 515" />
          </g>
          <g className="clicker-ending-stars">
            <circle cx="600" cy="390" r="78" />
            <circle cx="300" cy="390" r="4" />
            <circle cx="900" cy="390" r="3" />
            <circle cx="430" cy="270" r="3" />
            <circle cx="760" cy="505" r="4" />
            <path d="M600 280v-13m0 246v-13m-110-110h-13m246 0h-13M522 312l-9-9m183 183-9-9m0-165-9 9m-165 165-9 9" />
          </g>
        </svg>
        <span className="clicker-ending-glow" />
        <span className="clicker-ending-motes" />
      </div>
      <div className="clicker-ending-letterbox is-top" aria-hidden />
      <div className="clicker-ending-letterbox is-bottom" aria-hidden />

      <article className="clicker-ending" key={current.id}>
        <header className="clicker-ending-head">
          <div>
            <div className="clicker-ending-kicker">
              ENDING · {step + 1}/{CLICKER_TRUE_ENDING_STEPS.length}
              {current.accent ? <span className="clicker-ending-accent"> · {current.accent}</span> : null}
            </div>
            <h2 id="clicker-ending-title">{current.title}</h2>
          </div>
        </header>
        <p className="clicker-ending-body">{current.body}</p>

        {current.id === "worldlines" && summary && summary.worldlineNames.length > 0 ? (
          <ol className="clicker-ending-lines" aria-label="걸어온 세계선">
            {summary.worldlineNames.map((name, i) => (
              <li key={`${name}-${i}`} style={{ animationDelay: `${300 + i * 140}ms` }}>
                <span>{String(i + 1).padStart(2, "0")}</span> {name}
              </li>
            ))}
          </ol>
        ) : null}

        {last && summary ? (
          <dl className="clicker-ending-summary" aria-label="기록 요약">
            <div className="is-hero">
              <dt>플레이 시간</dt>
              <dd>{playMs === null ? "기록 없음" : formatClickerPlayTime(playMs)}</dd>
            </div>
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
            <div>
              <dt>채굴</dt>
              <dd>{summary.clicksText}</dd>
            </div>
            <div>
              <dt>처치한 크리처</dt>
              <dd>{summary.monstersSlain}</dd>
            </div>
          </dl>
        ) : null}
        {last ? <p className="clicker-ending-note">완료를 누르면 기록이 봉인되고 랭킹에 오릅니다.</p> : null}

        <div className="clicker-ending-dots" aria-hidden>
          {CLICKER_TRUE_ENDING_STEPS.map((s, i) => (
            <span key={s.id} className={i === step ? "is-active" : i < step ? "is-done" : ""} />
          ))}
        </div>
        <footer className="clicker-ending-foot">
          <button
            type="button"
            className={`clicker-primary${settled ? "" : " is-waiting"}`}
            autoFocus
            onClick={last ? armedPress(onComplete) : next}
          >
            {last ? "기록 봉인 · 완료" : "다음"}
          </button>
        </footer>
      </article>
    </div>
  )
}
