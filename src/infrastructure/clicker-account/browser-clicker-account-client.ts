import {
  loginClickerAccount,
  signupClickerAccount,
  type ClickerPublicAccount,
} from "@/application/clicker-account"
import {
  CLICKER_ACCOUNT_CHANGED_EVENT,
  type ClickerAccountAuthInput,
  type ClickerAccountClientPort,
  type ClickerAccountClientResult,
} from "@/application/ports/clicker-account-client"
import { flushClickerSaveBeforeAccountHandoff } from "@/application/clicker-account-client-bind"
import { readClickerLocalSession, writeClickerLocalSession } from "@/infrastructure/auth/clicker-local-session"
import { handoffClickerSaveForAccount } from "@/infrastructure/persistence/clicker-account-save-handoff"
import {
  browserClickerAccountPorts,
  readBrowserClickerAccountBook,
} from "@/infrastructure/persistence/browser-clicker-account-ports"
import { setClickerSaveSlotLoginId } from "@/infrastructure/persistence/clicker-save"

let serverAuthAvailable: boolean | null = null

async function callServer(path: string, init?: RequestInit) {
  const res = await fetch(`/api/clicker/auth/${path}`, { credentials: "same-origin", ...init })
  const data = (await res.json().catch(() => ({}))) as { account?: ClickerPublicAccount | null; error?: string }
  return { res, data }
}

function staticBuildStatus(status: number): boolean {
  return status === 404 || status === 405
}

async function serverReachable(): Promise<boolean> {
  if (serverAuthAvailable === false) return false
  if (serverAuthAvailable === true) return true
  try {
    const { res } = await callServer("me")
    if (staticBuildStatus(res.status)) {
      serverAuthAvailable = false
      return false
    }
    serverAuthAvailable = true
    return true
  } catch {
    serverAuthAvailable = false
    return false
  }
}

function toResult(
  result: Awaited<ReturnType<typeof signupClickerAccount>>,
): ClickerAccountClientResult {
  if (!result.ok) return { ok: false, status: result.status, error: result.error }
  return { ok: true, account: result.value.account }
}

async function syncLocalAccountBookToServer() {
  if (!(await serverReachable())) return
  const book = readBrowserClickerAccountBook()
  if (!Object.keys(book).length) return
  try {
    await fetch("/api/clicker/auth/merge-local", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accounts: book }),
    })
  } catch {
    /* best-effort */
  }
}

function applySession(account: ClickerPublicAccount | null) {
  const previous = readClickerLocalSession()?.loginId ?? null
  flushClickerSaveBeforeAccountHandoff()
  handoffClickerSaveForAccount(previous, account?.loginId ?? null)
  writeClickerLocalSession(account)
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CLICKER_ACCOUNT_CHANGED_EVENT))
  }
}

async function applySessionWithServerSync(account: ClickerPublicAccount | null, usedServer: boolean) {
  applySession(account)
  if (usedServer && account) await syncLocalAccountBookToServer()
}

export function createBrowserClickerAccountClient(): ClickerAccountClientPort {
  return {
    initSaveSlotFromSession() {
      const session = readClickerLocalSession()
      setClickerSaveSlotLoginId(session?.loginId ?? null)
    },
    async me() {
      if (await serverReachable()) {
        try {
          const { res, data } = await callServer("me")
          if (staticBuildStatus(res.status)) {
            serverAuthAvailable = false
          } else if (res.ok) {
            const account = data.account ?? null
            writeClickerLocalSession(account)
            setClickerSaveSlotLoginId(account?.loginId ?? null)
            return account
          }
        } catch {
          serverAuthAvailable = false
        }
      }
      const local = readClickerLocalSession()
      setClickerSaveSlotLoginId(local?.loginId ?? null)
      return local
    },
    async signup(input: ClickerAccountAuthInput) {
      if (await serverReachable()) {
        try {
          const { res, data } = await callServer("signup", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
          })
          if (staticBuildStatus(res.status)) serverAuthAvailable = false
          else if (res.ok && data.account) {
            await applySessionWithServerSync(data.account, true)
            return { ok: true, account: data.account }
          } else if (!staticBuildStatus(res.status)) {
            return { ok: false, status: res.status, error: data.error ?? "요청을 처리하지 못했어요." }
          }
        } catch {
          serverAuthAvailable = false
        }
      }
      const result = toResult(await signupClickerAccount(browserClickerAccountPorts, input))
      if (result.ok) applySession(result.account)
      return result
    },
    async login(input) {
      if (await serverReachable()) {
        try {
          const { res, data } = await callServer("login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
          })
          if (staticBuildStatus(res.status)) serverAuthAvailable = false
          else if (res.ok && data.account) {
            await applySessionWithServerSync(data.account, true)
            return { ok: true, account: data.account }
          } else if (!staticBuildStatus(res.status)) {
            return { ok: false, status: res.status, error: data.error ?? "요청을 처리하지 못했어요." }
          }
        } catch {
          serverAuthAvailable = false
        }
      }
      const result = toResult(await loginClickerAccount(browserClickerAccountPorts, input))
      if (result.ok) applySession(result.account)
      return result
    },
    async logout() {
      if (await serverReachable()) {
        await callServer("logout", { method: "POST" }).catch(() => {})
      }
      applySession(null)
    },
  }
}
