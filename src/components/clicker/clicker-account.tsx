"use client"

import { useState, type FormEvent } from "react"
import { createPortal } from "react-dom"
import { useClickerAccount } from "@/hooks/use-clicker-account"

/** Header button + dialog for logging in or creating a clicker account. */
export function ClickerAccount() {
  const { account, ready, busy, error, setError, submit, logout } = useClickerAccount()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"login" | "signup">("login")
  const [form, setForm] = useState({ loginId: "", nickname: "", password: "", passwordConfirm: "" })

  if (!ready) return null

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (await submit(mode, form)) {
      setOpen(false)
      setForm({ loginId: "", nickname: "", password: "", passwordConfirm: "" })
    }
  }

  return (
    <>
      {account ? (
        <button type="button" className="clicker-settings-launch clicker-account-btn" title="탭하여 로그아웃" onClick={() => void logout()}>
          {account.nickname} · 로그아웃
        </button>
      ) : (
        <button
          type="button"
          className="clicker-settings-launch clicker-account-btn"
          aria-haspopup="dialog"
          onClick={() => {
            setError(null)
            setOpen(true)
          }}
        >
          로그인
        </button>
      )}
      {open
        ? createPortal(
        <div className="clicker-account-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <form
            className="clicker-account-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={mode === "login" ? "로그인" : "회원가입"}
            onClick={(e) => e.stopPropagation()}
            onSubmit={onSubmit}
          >
            <h2>{mode === "login" ? "로그인" : "회원가입"}</h2>
            <label>
              아이디
              <input name="loginId" autoComplete="username" value={form.loginId} onChange={set("loginId")} required />
            </label>
            {mode === "signup" ? (
              <label>
                닉네임
                <input name="nickname" maxLength={12} value={form.nickname} onChange={set("nickname")} required />
              </label>
            ) : null}
            <label>
              비밀번호
              <input
                name="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={form.password}
                onChange={set("password")}
                required
              />
            </label>
            {mode === "signup" ? (
              <label>
                비밀번호 확인
                <input name="passwordConfirm" type="password" autoComplete="new-password" value={form.passwordConfirm} onChange={set("passwordConfirm")} required />
              </label>
            ) : null}
            {error ? <p className="clicker-account-error" role="alert">{error}</p> : null}
            <button type="submit" disabled={busy}>
              {busy ? "처리 중…" : mode === "login" ? "로그인" : "가입하기"}
            </button>
            <button
              type="button"
              className="is-link"
              onClick={() => {
                setError(null)
                setMode(mode === "login" ? "signup" : "login")
              }}
            >
              {mode === "login" ? "계정이 없나요? 회원가입" : "이미 계정이 있나요? 로그인"}
            </button>
          </form>
        </div>,
        document.body,
      )
        : null}
    </>
  )
}
