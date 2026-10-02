"use client"

import { useState } from "react"
import type { ClickerAccountState } from "@/hooks/use-clicker-account"
import { ClickerAccountForm, ClickerAccountMessage } from "./clicker-account"

const LOGIN_BG = "/clicker/bg/login_core_sanctum.webp"

type Props = {
  state: ClickerAccountState
  /** This device already has a run (the title screen was passed at least once). */
  hasLocalRun: boolean
  /** Close the gate: logged in, or playing as a guest. */
  onDone: (how: "account" | "guest") => void
}

/**
 * First screen of the game: log in, sign up, or continue as a guest. Accounts keep the run
 * in the cloud; a guest run lives on this device only. While the account store is not
 * configured the form is shown disabled and guest play stays open.
 */
export function ClickerLoginGate({ state, hasLocalRun, onDone }: Props) {
  /** Logged in with a cloud save while this device has its own run: ask which one to keep. */
  const [choose, setChoose] = useState(false)
  const ready = state.storage

  const afterSuccess = async (mode: "login" | "signup") => {
    // Signup uploads this device's run, so only a login can find an older cloud save.
    if (mode === "login" && state.cloudWaiting()) {
      if (!hasLocalRun) {
        await state.download()
        onDone("account")
        return
      }
      setChoose(true)
      return
    }
    onDone("account")
  }

  return (
    <div className="clicker-login" role="dialog" aria-labelledby="clicker-login-brand" aria-describedby="clicker-login-lead">
      <img className="clicker-login-bg" src={LOGIN_BG} alt="" aria-hidden decoding="async" fetchPriority="high" />
      <div className="clicker-login-veil" aria-hidden />
      <section className="clicker-login-panel">
        <p className="clicker-login-kicker">WORLD LINE PROTOCOL</p>
        <h1 id="clicker-login-brand" className="clicker-login-brand">
          AURELIA CORE
        </h1>
        <p id="clicker-login-lead" className="clicker-login-lead">
          {choose ? "클라우드에 저장된 진행이 있습니다. 어느 진행으로 이어 할까요?" : "로그인하면 진행이 클라우드에 저장돼 어느 기기에서든 이어 할 수 있습니다."}
        </p>

        {choose ? (
          <div className="clicker-login-choice">
            <button
              type="button"
              className="clicker-primary"
              disabled={state.busy}
              onClick={async () => {
                await state.download()
                onDone("account")
              }}
            >
              클라우드 진행 이어 하기
            </button>
            <button type="button" className="clicker-ghost" disabled={state.busy} onClick={() => onDone("account")}>
              이 기기 진행으로 계속
            </button>
            <p className="clicker-account-note">클라우드 진행을 고르면 이 기기의 진행은 백업된 뒤 바뀝니다. 설정 → 계정에서 언제든 다시 바꿀 수 있습니다.</p>
          </div>
        ) : (
          <>
            {ready ? null : (
              <p className="clicker-account-note is-warn" role="status">
                계정 서버를 준비하고 있습니다. 지금은 게스트로 시작해 주세요. 진행은 이 기기에 저장됩니다.
              </p>
            )}
            <ClickerAccountForm state={state} autoFocus={ready} disabled={!ready} onSuccess={(mode) => void afterSuccess(mode)} />
            <div className="clicker-login-divider" aria-hidden>
              <span>또는</span>
            </div>
            <button type="button" className="clicker-ghost clicker-login-guest" disabled={state.busy} onClick={() => onDone("guest")}>
              게스트로 시작
            </button>
            <p className="clicker-account-note">게스트 진행은 이 기기에만 저장됩니다. 나중에 설정 → 계정에서 가입하면 그대로 클라우드로 옮겨집니다.</p>
          </>
        )}
        <ClickerAccountMessage state={state} />
      </section>
    </div>
  )
}
