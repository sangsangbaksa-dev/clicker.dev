"use client"

import { useState, type FormEvent } from "react"
import type { ClickerAccountState } from "@/hooks/use-clicker-account"

function savedAtLabel(at: number) {
  return new Date(at).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

/** Settings → 계정: log in or sign up, then keep the run in the cloud. */
export function ClickerAccountPanel({ state }: { state: ClickerAccountState }) {
  const [mode, setMode] = useState<"login" | "signup">("login")
  const [loginId, setLoginId] = useState("")
  const [nickname, setNickname] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirm, setPasswordConfirm] = useState("")
  const [confirmLoad, setConfirmLoad] = useState(false)
  if (!state.available) return null
  const { account, cloud, busy, message } = state

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (mode === "login") void state.login(loginId, password)
    else void state.signup({ loginId, nickname, password, passwordConfirm })
    setPassword("")
    setPasswordConfirm("")
  }

  return (
    <section className="clicker-account" aria-labelledby="clicker-account-title">
      <h3 id="clicker-account-title">계정</h3>
      {account ? (
        <>
          <p className="clicker-account-who">
            <b>{account.nickname}</b> <small>@{account.loginId}</small>
          </p>
          <p className="clicker-account-note">
            {cloud ? `클라우드 저장: ${savedAtLabel(cloud.savedAt)}` : "클라우드에 저장된 진행이 아직 없습니다."} · 2분마다 자동 저장
          </p>
          <div className="clicker-account-actions">
            <button type="button" className="clicker-primary" disabled={busy} onClick={() => void state.upload()}>
              지금 클라우드에 저장
            </button>
            {confirmLoad ? (
              <button
                type="button"
                className="clicker-danger"
                disabled={busy}
                onClick={() => {
                  setConfirmLoad(false)
                  void state.download()
                }}
              >
                이 기기 진행을 덮어쓰기
              </button>
            ) : (
              <button type="button" className="clicker-ghost" disabled={busy || !cloud} onClick={() => setConfirmLoad(true)}>
                클라우드에서 불러오기
              </button>
            )}
            <button type="button" className="clicker-ghost" disabled={busy} onClick={() => void state.logout()}>
              로그아웃
            </button>
          </div>
          {confirmLoad ? <p className="clicker-account-note is-warn">지금 이 기기의 진행은 백업된 뒤 클라우드 진행으로 바뀝니다.</p> : null}
        </>
      ) : (
        <form className="clicker-account-form" onSubmit={submit}>
          <div className="clicker-account-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "is-on" : ""} onClick={() => setMode("login")}>
              로그인
            </button>
            <button type="button" role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "is-on" : ""} onClick={() => setMode("signup")}>
              회원가입
            </button>
          </div>
          <label>
            <span>아이디</span>
            <input
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="영문 소문자·숫자 3~20자"
              required
            />
          </label>
          {mode === "signup" ? (
            <label>
              <span>닉네임</span>
              <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={12} placeholder="게임에서 보일 이름" required />
            </label>
          ) : null}
          <label>
            <span>비밀번호</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder={mode === "signup" ? "6자 이상" : ""}
              required
            />
          </label>
          {mode === "signup" ? (
            <label>
              <span>비밀번호 확인</span>
              <input type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} autoComplete="new-password" required />
            </label>
          ) : null}
          <button type="submit" className="clicker-primary" disabled={busy}>
            {busy ? "처리 중…" : mode === "login" ? "로그인" : "가입하고 진행 저장"}
          </button>
          <p className="clicker-account-note">로그인하면 진행이 클라우드에 저장돼 다른 기기에서도 이어 할 수 있습니다.</p>
        </form>
      )}
      {message ? (
        <p className={`clicker-account-msg is-${message.tone}`} role="status">
          {message.text}
        </p>
      ) : null}
    </section>
  )
}
