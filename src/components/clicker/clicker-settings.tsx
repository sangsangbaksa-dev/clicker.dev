"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { useClickerDialogFocus, useClickerEscape } from "@/components/clicker/clicker-a11y"
import { MINE_POTION_HOTKEY_LABELS, MINE_SKILL_HOTKEY_SLOTS, registerSecretTap, type SecretTapState } from "@/application/clicker-ui"
import { CLICKER_FEEDBACK_CATEGORIES, type ClickerFeedback, type ClickerFeedbackCategory } from "@/application/clicker-ui"
import { ClickerAccountPanel } from "@/components/clicker/clicker-account"
import type { ClickerAccountState } from "@/hooks/use-clicker-account"

type Props = {
  muted: boolean
  musicMuted: boolean
  musicVolume: number
  onToggleMute: () => void
  onToggleMusic: () => void
  onMusicVolume: (volume: number) => void
  /** Wipe the save and start over (title and tutorial come back). */
  onReset: () => void
  /** Hidden: tapping the title a few times quickly reveals the admin tools. */
  onSecretAdmin?: () => void
  /** Login / signup / cloud save; hidden where there is no account server. */
  account?: ClickerAccountState
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
  onReset,
  onSecretAdmin,
  account,
  onClose,
}: Props) {
  const secretTaps = useRef<SecretTapState>({ count: 0, first: 0 })
  const [resetArmed, setResetArmed] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const reducedMotion = useReducedMotion()
  useClickerDialogFocus(rootRef)
  useClickerEscape(true, onClose)
  const volumePct = Math.round(musicVolume * 100)
  const skillKeys = Array.from({ length: MINE_SKILL_HOTKEY_SLOTS }, (_, i) => String(i + 1)).join(" · ")
  const potionKeys = MINE_POTION_HOTKEY_LABELS.slice(0, 5).join(" · ")

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
            <h2
              id="clicker-settings-title"
              onClick={() => {
                const r = registerSecretTap(secretTaps.current, Date.now())
                secretTaps.current = r.state
                if (r.unlocked) onSecretAdmin?.()
              }}
            >
              설정
            </h2>
          </div>
          <button type="button" className="clicker-ghost" onClick={onClose} aria-keyshortcuts="Escape">
            닫기
          </button>
        </header>

        {account ? <ClickerAccountPanel state={account} /> : null}

        <section className="clicker-settings-hotkeys" aria-labelledby="clicker-settings-hotkeys-title">
          <h3 id="clicker-settings-hotkeys-title">광산 단축키</h3>
          <p className="clicker-settings-hotkeys-lead">채굴 화면에서만 동작합니다. 입력창에 포커스가 있으면 쓰이지 않습니다.</p>
          <ul className="clicker-settings-hotkeys-list">
            <li>
              <span className="clicker-settings-hotkeys-keys" aria-hidden>{skillKeys}</span>
              <span className="clicker-settings-hotkeys-desc">
                <strong>액티브 스킬</strong>
                <span>하단·오른쪽 스킬 순서대로 1~9</span>
              </span>
            </li>
            <li>
              <span className="clicker-settings-hotkeys-keys" aria-hidden>{potionKeys}</span>
              <span className="clicker-settings-hotkeys-desc">
                <strong>포션</strong>
                <span>왼쪽 포션 줄 순서대로 Q · W · E · R · T (오버드라이브는 한 번 더 눌러 확인)</span>
              </span>
            </li>
            <li>
              <span className="clicker-settings-hotkeys-keys" aria-hidden>Space</span>
              <span className="clicker-settings-hotkeys-desc">
                <strong>연속 채굴</strong>
                <span>커서 위치로 레이저 (누르고 있기)</span>
              </span>
            </li>
          </ul>
        </section>

        <ul className="clicker-settings-list">
          <li className="clicker-settings-row">
            <div className="clicker-settings-copy">
              <strong>효과음</strong>
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
              <p>월드마다 다른 테마가 흐릅니다.</p>
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
          <li className="clicker-settings-row">
            <div className="clicker-settings-copy">
              <strong>저장 초기화</strong>
              <p>{resetArmed ? "한 번 더 누르면 모든 진행이 지워집니다." : "처음부터 다시 시작합니다."}</p>
            </div>
            <button type="button" className="clicker-danger" onClick={() => (resetArmed ? onReset() : setResetArmed(true))}>
              {resetArmed ? "확인" : "초기화"}
            </button>
          </li>
        </ul>
        <p className="clicker-settings-autosave-note">진행은 이 브라우저에 자동 저장됩니다.</p>
        <ClickerFeedbackPanel />
      </aside>
    </div>
  )
}

const FEEDBACK_CATEGORY_LABEL: Record<ClickerFeedbackCategory, string> = {
  bug: "오류 제보",
  idea: "개선 제안",
  other: "기타 의견",
}

type FeedbackResponse = {
  error?: string
  entry?: ClickerFeedback
  entries?: ClickerFeedback[]
}

function ClickerFeedbackPanel() {
  const [category, setCategory] = useState<ClickerFeedbackCategory>("idea")
  const [message, setMessage] = useState("")
  const [author, setAuthor] = useState("")
  const [handle, setHandle] = useState("")
  const [entries, setEntries] = useState<ClickerFeedback[] | null>(null)
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const sendRequest = async (body: Record<string, string>): Promise<FeedbackResponse> => {
    const response = await fetch("/api/clicker/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const result = (await response.json()) as FeedbackResponse
    if (!response.ok) throw new Error(result.error ?? "요청을 처리하지 못했습니다.")
    return result
  }

  const submitFeedback = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setStatus(null)
    try {
      await sendRequest({ action: "submit", category, message, author })
      setMessage("")
      setAuthor("")
      setStatus({ tone: "ok", text: "피드백을 보냈습니다. 소중한 의견 감사합니다." })
    } catch (error) {
      setStatus({
        tone: "error",
        text: error instanceof Error ? error.message : "피드백을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.",
      })
    } finally {
      setBusy(false)
    }
  }

  const showFeedback = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setEntries(null)
    setStatus(null)
    try {
      const result = await sendRequest({ action: "list", handle })
      setEntries(result.entries ?? [])
      setStatus({ tone: "ok", text: `피드백 ${result.entries?.length ?? 0}건을 불러왔습니다.` })
    } catch (error) {
      setStatus({
        tone: "error",
        text: error instanceof Error ? error.message : "피드백을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="clicker-feedback" aria-labelledby="clicker-feedback-title">
      <div className="clicker-feedback-head">
        <strong id="clicker-feedback-title">개발 피드백</strong>
        <p>오류 제보와 개선 아이디어를 보내주세요.</p>
      </div>
      <form className="clicker-feedback-form" onSubmit={submitFeedback}>
        <label htmlFor="clicker-feedback-category">종류</label>
        <select
          id="clicker-feedback-category"
          className="clicker-feedback-input"
          value={category}
          onChange={(event) => setCategory(event.target.value as ClickerFeedbackCategory)}
        >
          {CLICKER_FEEDBACK_CATEGORIES.map((item) => (
            <option key={item} value={item}>{FEEDBACK_CATEGORY_LABEL[item]}</option>
          ))}
        </select>
        <label htmlFor="clicker-feedback-message">내용</label>
        <textarea
          id="clicker-feedback-message"
          className="clicker-feedback-input"
          rows={4}
          minLength={3}
          maxLength={2000}
          required
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="게임을 하며 느낀 점이나 불편한 점을 적어 주세요."
        />
        <label htmlFor="clicker-feedback-author">이름 (선택)</label>
        <input
          id="clicker-feedback-author"
          className="clicker-feedback-input"
          maxLength={40}
          value={author}
          onChange={(event) => setAuthor(event.target.value)}
          placeholder="익명으로 보낼 수 있어요."
        />
        <button type="submit" className="clicker-settings-toggle is-on" disabled={busy || message.trim().length < 3}>
          {busy ? "전송 중…" : "피드백 보내기"}
        </button>
      </form>

      <form className="clicker-feedback-access" onSubmit={showFeedback}>
        <label htmlFor="clicker-feedback-handle">개발 피드백 보기</label>
        <p>개발자 아이디를 입력하면 접수된 피드백을 확인할 수 있습니다.</p>
        <div className="clicker-feedback-access-row">
          <input
            id="clicker-feedback-handle"
            className="clicker-feedback-input"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={handle}
            onChange={(event) => {
              setHandle(event.target.value)
              setEntries(null)
              setStatus(null)
            }}
            placeholder="@아이디"
          />
          <button type="submit" className="clicker-settings-toggle" disabled={busy || !handle.trim()}>
            보기
          </button>
        </div>
      </form>

      {entries ? (
        entries.length ? (
          <ol className="clicker-feedback-list">
            {entries.map((entry) => (
              <li key={entry.id} className="clicker-feedback-entry">
                <div className="clicker-feedback-entry-meta">
                  <strong>{FEEDBACK_CATEGORY_LABEL[entry.category]}</strong>
                  <time dateTime={entry.createdAt}>
                    {new Date(entry.createdAt).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" })}
                  </time>
                </div>
                <p>{entry.message}</p>
                <span>{entry.author || "익명"}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="clicker-feedback-empty">아직 접수된 피드백이 없습니다.</p>
        )
      ) : null}

      <p
        className={`clicker-feedback-status${status?.tone === "error" ? " is-error" : ""}`}
        role="status"
        aria-live="polite"
      >
        {status?.text ?? ""}
      </p>
    </section>
  )
}
