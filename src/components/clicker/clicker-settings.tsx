"use client"

import { useEffect, useRef, useState } from "react"
import { useClickerDialogFocus, useClickerEscape } from "@/components/clicker/clicker-a11y"
import { formatNumber } from "@/domain/services/clicker-format"
import type { ParsedSaveCode } from "@/domain/services/clicker-save-transfer"

type Props = {
  muted: boolean
  musicMuted: boolean
  musicVolume: number
  onToggleMute: () => void
  onToggleMusic: () => void
  onMusicVolume: (volume: number) => void
  onExportCode: () => string | null
  onParseCode: (code: string) => ParsedSaveCode
  onImportJson: (json: string) => boolean
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
  onExportCode,
  onParseCode,
  onImportJson,
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

        <ClickerSaveTransfer
          onExportCode={onExportCode}
          onParseCode={onParseCode}
          onImportJson={onImportJson}
          onImported={onClose}
        />
      </aside>
    </div>
  )
}

function fileStamp(at: number) {
  const d = new Date(at)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

function savedAtLabel(at: number) {
  if (!at) return "알 수 없음"
  return new Date(at).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

/**
 * Save code export / import. The save only lives in this browser's localStorage, which
 * Safari clears after a week without a visit — a code lets players keep a copy or move
 * the run to another device.
 */
function ClickerSaveTransfer({
  onExportCode,
  onParseCode,
  onImportJson,
  onImported,
}: {
  onExportCode: () => string | null
  onParseCode: (code: string) => ParsedSaveCode
  onImportJson: (json: string) => boolean
  onImported: () => void
}) {
  const [draft, setDraft] = useState("")
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null)
  const [pending, setPending] = useState<Extract<ParsedSaveCode, { ok: true }> | null>(null)
  const [shownCode, setShownCode] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const codeRef = useRef<HTMLTextAreaElement | null>(null)
  const confirmRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (pending) confirmRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [pending])

  const copyCode = async () => {
    const code = onExportCode()
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setShownCode(null)
      setStatus({ tone: "ok", text: "저장 코드를 복사했습니다. 메모나 메신저에 붙여 넣어 보관하세요." })
    } catch {
      // Clipboard blocked (http, old WebView): show the code to copy by hand.
      setShownCode(code)
      setStatus({ tone: "ok", text: "아래 코드를 길게 눌러 전체 선택 후 복사하세요." })
      window.setTimeout(() => codeRef.current?.select(), 0)
    }
  }

  const downloadCode = () => {
    const code = onExportCode()
    if (!code) return
    const url = URL.createObjectURL(new Blob([code + "\n"], { type: "text/plain" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `aurelia-core-${fileStamp(Date.now())}.txt`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setStatus({ tone: "ok", text: "저장 파일을 내려받았습니다." })
  }

  const check = (text: string) => {
    const parsed = onParseCode(text)
    if (!parsed.ok) {
      setPending(null)
      setStatus({ tone: "error", text: parsed.error })
      return
    }
    setPending(parsed)
    setStatus(null)
  }

  const readFile = async (file: File | undefined) => {
    if (!file) return
    if (file.size > 2_000_000) {
      setStatus({ tone: "error", text: "파일이 너무 큽니다. 게임에서 내보낸 저장 파일을 고르세요." })
      return
    }
    const text = await file.text()
    setDraft(text.trim())
    check(text)
  }

  const confirmImport = () => {
    if (!pending) return
    if (!onImportJson(pending.json)) {
      setStatus({ tone: "error", text: "브라우저 저장소에 쓸 수 없어 불러오지 못했습니다. 현재 진행은 그대로입니다." })
      return
    }
    setPending(null)
    setDraft("")
    onImported()
  }

  return (
    <section className="clicker-save-transfer" aria-labelledby="clicker-save-transfer-title">
      <div className="clicker-settings-copy">
        <strong id="clicker-save-transfer-title">저장 데이터</strong>
        <p>진행은 이 브라우저에만 저장됩니다. 코드를 보관해 두면 다른 기기에서 이어 하거나 지워졌을 때 되살릴 수 있습니다.</p>
      </div>
      <div className="clicker-save-transfer-actions">
        <button type="button" className="clicker-settings-toggle" onClick={() => void copyCode()}>
          코드 복사
        </button>
        <button type="button" className="clicker-settings-toggle" onClick={downloadCode}>
          파일로 저장
        </button>
      </div>
      {shownCode ? (
        <textarea
          ref={codeRef}
          className="clicker-save-transfer-input"
          readOnly
          rows={3}
          value={shownCode}
          aria-label="내 저장 코드"
          onFocus={(e) => e.currentTarget.select()}
        />
      ) : null}

      <label className="clicker-save-transfer-label" htmlFor="clicker-save-import">
        불러오기
      </label>
      <textarea
        id="clicker-save-import"
        className="clicker-save-transfer-input"
        rows={3}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        placeholder="AURELIA1.… 로 시작하는 코드를 붙여 넣기"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          setPending(null)
          setStatus(null)
        }}
      />
      <div className="clicker-save-transfer-actions">
        <button
          type="button"
          className="clicker-settings-toggle"
          disabled={!draft.trim()}
          onClick={() => check(draft)}
        >
          코드 확인
        </button>
        <button type="button" className="clicker-settings-toggle" onClick={() => fileRef.current?.click()}>
          파일 열기
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.json,text/plain,application/json"
          hidden
          onChange={(e) => {
            void readFile(e.target.files?.[0])
            e.target.value = ""
          }}
        />
      </div>

      {pending ? (
        <div ref={confirmRef} className="clicker-save-transfer-confirm" role="alert">
          <p>
            <strong>이 진행으로 바꿀까요?</strong> 보유 CORE {formatNumber(pending.summary.coreEnergy)} · 누적{" "}
            {formatNumber(pending.summary.totalCoreEnergy)} · 환생 {pending.summary.rebirthCount}회 · 저장{" "}
            {savedAtLabel(pending.summary.savedAt)}
          </p>
          <p>지금 이 기기의 진행은 덮어써집니다(백업 1개는 브라우저에 남겨 둡니다).</p>
          <div className="clicker-save-transfer-actions">
            <button type="button" className="clicker-settings-toggle is-on" onClick={confirmImport}>
              덮어쓰고 불러오기
            </button>
            <button type="button" className="clicker-settings-toggle" onClick={() => setPending(null)}>
              취소
            </button>
          </div>
        </div>
      ) : null}

      <p
        className={`clicker-save-transfer-status${status?.tone === "error" ? " is-error" : ""}`}
        role="status"
        aria-live="polite"
      >
        {status?.text ?? ""}
      </p>
    </section>
  )
}
