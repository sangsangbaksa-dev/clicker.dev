"use client"

import { useCallback, useEffect, useState } from "react"
import type { ClickerPublicAccount } from "@/application/clicker-account"
import { clickerAccountClient } from "@/application/clicker-account-client-bind"

type Mode = "login" | "signup"

export function useClickerAccount() {
  const [account, setAccount] = useState<ClickerPublicAccount | null>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    clickerAccountClient()
      .me()
      .then((a) => {
        if (!alive) return
        setAccount(a)
        setReady(true)
      })
      .catch(() => alive && setReady(true))
    return () => {
      alive = false
    }
  }, [])

  const submit = useCallback(
    async (mode: Mode, form: { loginId: string; nickname: string; password: string; passwordConfirm: string }) => {
      setBusy(true)
      setError(null)
      try {
        const client = clickerAccountClient()
        const result =
          mode === "signup"
            ? await client.signup(form)
            : await client.login({ loginId: form.loginId, password: form.password })
        if (!result.ok) {
          setError(result.error)
          return false
        }
        setAccount(result.account)
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
    await clickerAccountClient().logout()
    setAccount(null)
  }, [])

  return { account, ready, busy, error, setError, submit, logout }
}
