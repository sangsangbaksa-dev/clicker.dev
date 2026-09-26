"use client"

import { useRef, useState, type FormEvent, type ReactNode } from "react"
import { useClickerDialogFocus } from "@/components/clicker/clicker-a11y"
import { NICKNAME_MAX, PASSWORD_MIN } from "@/domain/services/clicker-account"
import type { SaveSummary } from "@/domain/services/clicker-cloud-sync"
import { formatNumber } from "@/domain/services/clicker-format"
import type { ClickerAccount, CloudConflict, CloudStatus } from "@/hooks/use-clicker-cloud"

const STATUS_TEXT: Record<CloudStatus, string> = {
  idle: "대기 중",
  syncing: "저장 중…",
  synced: "클라우드에 저장됨",
  offline: "서버 연결 안 됨 — 이 기기에는 계속 저장됩니다",
}

type PanelProps = {
  account: ClickerAccount | null
  ready: boolean
  status: CloudStatus
  onSignIn: (mode: "login" | "signup", nickname: string, password: string) => Promise<string | null>
  onSignOut: () => void
  onSyncNow: () => void
}

/** Settings section: sign in / sign up, or who is signed in and how syncing is going. */
export function ClickerAccountPanel({ account, ready, status, onSignIn, onSignOut, onSyncNow }: PanelProps) {
  const [mode, setMode] = useState<"login" | "signup">("login")
  const [nickname, setNickname] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!ready) return <p className="clicker-account-note">계정 확인 중…</p>

  if (account) {
    return (
      <div className="clicker-account">
        <div className="clicker-account-who">
          <span className="clicker-account-avatar" aria-hidden>
            {[...account.nickname][0]}
          </span>
          <div>
            <strong>{account.nickname}</strong>
            <p className={`clicker-account-status is-${status}`} role="status">
              {STATUS_TEXT[status]}
            </p>
          </div>
        </div>
        <div className="clicker-account-actions">
          <button type="button" className="clicker-ghost" onClick={onSyncNow} disabled={status === "syncing"}>
            지금 저장
          </button>
          <button type="button" className="clicker-ghost" onClick={onSignOut}>
            로그아웃
          </button>
        </div>
      </div>
    )
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const message = await onSignIn(mode, nickname, password)
    setBusy(false)
    if (message) setError(message)
    else setPassword("")
  }

  return (
    <form className="clicker-account-form" onSubmit={submit}>
      <div className="clicker-account-tabs" role="tablist" aria-label="계정">
        {(["login", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            className={mode === m ? "is-active" : ""}
            onClick={() => {
              setMode(m)
              setError(null)
            }}
          >
            {m === "login" ? "로그인" : "새 계정"}
          </button>
        ))}
      </div>
      <p className="clicker-account-note">
        {mode === "login"
          ? "로그인하면 진행이 서버에 저장되어 다른 기기에서도 이어서 할 수 있습니다."
          : "닉네임과 비밀번호만 있으면 바로 만들어집니다. 게임 전용 계정입니다."}
      </p>
      <label className="clicker-account-field">
        <span>닉네임</span>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          autoComplete="username"
          maxLength={NICKNAME_MAX}
          required
        />
      </label>
      <label className="clicker-account-field">
        <span>비밀번호{mode === "signup" ? ` (${PASSWORD_MIN}자 이상)` : ""}</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          minLength={mode === "signup" ? PASSWORD_MIN : undefined}
          required
        />
      </label>
      {error ? (
        <p className="clicker-account-error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="clicker-primary" disabled={busy}>
        {busy ? "확인 중…" : mode === "login" ? "로그인" : "계정 만들기"}
      </button>
    </form>
  )
}

function describe(s: SaveSummary | null) {
  if (!s) return "진행 없음"
  const when = s.savedAt ? new Date(s.savedAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "medium" }) : "?"
  return `환생 ${s.rebirths}회 · 누적 CORE ${formatNumber(s.lifetimeCore)} · ${when}`
}

/** Both this device and the account hold real, different progress — the player chooses. */
export function ClickerCloudConflict({
  conflict,
  onResolve,
}: {
  conflict: CloudConflict
  onResolve: (keep: "cloud" | "local") => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  useClickerDialogFocus(ref)
  return (
    <div className="clicker-settings-backdrop">
      <div ref={ref} className="clicker-settings clicker-cloud-conflict" role="alertdialog" aria-modal="true" aria-labelledby="clicker-conflict-title">
        <h2 id="clicker-conflict-title">어느 진행을 이어갈까요?</h2>
        <p className="clicker-account-note">이 기기와 계정에 서로 다른 진행이 있습니다. 고르지 않은 쪽은 덮어씌워집니다 (이 기기 진행은 백업이 남습니다).</p>
        <button type="button" className="clicker-cloud-choice" onClick={() => onResolve("cloud")}>
          <strong>계정에 저장된 진행</strong>
          <span>{describe(conflict.cloud)}</span>
        </button>
        <button type="button" className="clicker-cloud-choice" onClick={() => onResolve("local")}>
          <strong>이 기기의 진행</strong>
          <span>{describe(conflict.local)}</span>
        </button>
      </div>
    </div>
  )
}

/** Title-screen disclosure: a quiet link that opens the sign-in panel in place. */
export function ClickerTitleAccount({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  if (!open) {
    return (
      <button type="button" className="clicker-title-account-link" onClick={() => setOpen(true)}>
        이미 계정이 있나요? 로그인하고 이어하기
      </button>
    )
  }
  return <div className="clicker-title-account">{children}</div>
}
