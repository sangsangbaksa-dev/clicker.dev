"use client"

import type { ClickerAccountState } from "@/hooks/use-clicker-account"
import { ClickerAccountForm, ClickerAccountMessage } from "./clicker-account"

const LOGIN_BG = "/clicker/bg/login_core_sanctum.webp"

type Props = {
  state: ClickerAccountState
  /** Close the gate: logged in, or playing as a guest. */
  onDone: (how: "account" | "guest") => void
}

/**
 * First screen of the game: log in, sign up, or continue as a guest. Accounts keep the run
 * in the cloud; a guest run lives on this device only. While the account store is not
 * configured the form is shown disabled and guest play stays open.
 */
export function ClickerLoginGate({ state, onDone }: Props) {
  const ready = state.storage

  return (
    <div className="clicker-login" role="dialog" aria-labelledby="clicker-login-brand" aria-describedby="clicker-login-lead">
      <img className="clicker-login-bg" src={LOGIN_BG} alt="" aria-hidden decoding="async" fetchPriority="high" />
      <div className="clicker-login-veil" aria-hidden />
      {/* Only this layer scrolls: the art stays pinned to the screen when the form grows. */}
      <div className="clicker-login-scroll">
        <section className="clicker-login-panel">
          <p className="clicker-login-kicker">WORLD LINE PROTOCOL</p>
          <h1 id="clicker-login-brand" className="clicker-login-brand">
            AURELIA CORE
          </h1>
          <p id="clicker-login-lead" className="clicker-login-lead">
            로그인하면 진행이 클라우드에 저장돼 어느 기기에서든 이어 할 수 있습니다. 누적 CORE가 더 높은 진행으로 자동으로 이어집니다.
          </p>

          {ready ? null : (
            <p className="clicker-account-note is-warn" role="status">
              계정 서버를 준비하고 있습니다. 지금은 게스트로 시작해 주세요. 진행은 이 기기에 저장됩니다.
            </p>
          )}
          <ClickerAccountForm state={state} autoFocus={ready} disabled={!ready} onSuccess={() => onDone("account")} />
          <div className="clicker-login-divider" aria-hidden>
            <span>또는</span>
          </div>
          <button type="button" className="clicker-ghost clicker-login-guest" disabled={state.busy} onClick={() => onDone("guest")}>
            게스트로 시작
          </button>
          <p className="clicker-account-note">
            게스트 진행은 이 기기에만 저장됩니다. 나중에 설정 → 계정에서 가입하면 그대로 클라우드로 옮겨집니다.
          </p>
          <ClickerAccountMessage state={state} />
        </section>
      </div>
    </div>
  )
}
