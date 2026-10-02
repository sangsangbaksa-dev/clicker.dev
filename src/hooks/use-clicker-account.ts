"use client"

import { useCallback, useEffect, useState } from "react"
import type { ClickerPublicAccount } from "@/application/clicker-account"

type Mode = "login" | "signup"

async function call(path: string, init?: RequestInit) {
  const res = await fetch(`/api/clicker/auth/${path}`, { credentials: "same-origin", ...init })
  const data = (await res.json().catch(() => ({}))) as { account?: ClickerPublicAccount | null; error?: string }
  return { ok: res.ok, status: res.status, data }
}

export function useClickerAccount() {
  const [account, setAccount] = useState<ClickerPublicAccount | null>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    call("me").then(({ data }) => {
      if (!alive) return
      setAccount(data.account ?? null)
      setReady(true)
    }, () => alive && setReady(true))
    return () => {
      alive = false
    }
  }, [])

  const submit = useCallback(
    async (mode: Mode, form: { loginId: string; nickname: string; password: string; passwordConfirm: string }) => {
      setBusy(true)
      setError(null)
      try {
        const { ok, status, data } = await call(mode, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(form),
        })
        if (!ok || !data.account) {
          setError(
            data.error ??
              (status === 404 || status === 405
                ? "이 배포(정적 빌드)에서는 로그인·가입을 쓸 수 없어요. 서버가 있는 주소에서 이용해 주세요."
                : "요청을 처리하지 못했어요."),
          )
          return false
        }
        setAccount(data.account)
        return true
      } catch {
        setError("네트워크 오류가 났어요. 다시 시도해 주세요.")
        return false
      } finally {
        setBusy(false)
      }
    },
    [],
  )

  const logout = useCallback(async () => {
    await call("logout", { method: "POST" }).catch(() => {})
    setAccount(null)
  }, [])

  return { account, ready, busy, error, setError, submit, logout }
}
