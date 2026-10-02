"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  fetchClickerAccount,
  fetchCloudSave,
  loginClickerAccount,
  logoutClickerAccount,
  signupClickerAccount,
  uploadCloudSave,
  type ClickerAccountInfo,
  type ClickerCloudSave,
} from "@/application/clicker-account"

/** While logged in, the run is copied to the cloud this often (and when the page closes). */
const AUTO_UPLOAD_MS = 2 * 60 * 1000

type Options = {
  /** Current save as stored JSON, or null before the game has loaded. */
  getSaveJson: () => string | null
  /** Replace this device's save with the cloud one. */
  applySaveJson: (json: string) => boolean
}

export type ClickerAccountState = ReturnType<typeof useClickerAccount>

export function useClickerAccount({ getSaveJson, applySaveJson }: Options) {
  const [available, setAvailable] = useState(false)
  const [storage, setStorage] = useState(true)
  const [account, setAccount] = useState<ClickerAccountInfo | null>(null)
  const [cloud, setCloud] = useState<ClickerCloudSave["meta"] | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null)
  const getJson = useRef(getSaveJson)
  const apply = useRef(applySaveJson)
  useEffect(() => {
    getJson.current = getSaveJson
    apply.current = applySaveJson
  })

  const refreshCloud = useCallback(async () => {
    const r = await fetchCloudSave()
    setCloud(r.ok ? (r.value.save?.meta ?? null) : null)
  }, [])

  useEffect(() => {
    let alive = true
    fetchClickerAccount().then((r) => {
      if (!alive) return
      setAvailable(r.available)
      setStorage(r.storage)
      setAccount(r.account)
      if (r.account) void refreshCloud()
    })
    return () => {
      alive = false
    }
  }, [refreshCloud])

  const run = useCallback(async (job: () => Promise<{ tone: "ok" | "error"; text: string } | null>) => {
    setBusy(true)
    setMessage(null)
    try {
      setMessage(await job())
    } finally {
      setBusy(false)
    }
  }, [])

  const signedIn = useCallback(
    async (next: ClickerAccountInfo, verb: string) => {
      setAccount(next)
      await refreshCloud()
      return { tone: "ok" as const, text: `${next.nickname}님, ${verb}` }
    },
    [refreshCloud],
  )

  const login = useCallback(
    (loginId: string, password: string) =>
      run(async () => {
        const r = await loginClickerAccount(loginId, password)
        return r.ok ? signedIn(r.value.account, "환영합니다.") : { tone: "error", text: r.error }
      }),
    [run, signedIn],
  )

  const signup = useCallback(
    (input: { loginId: string; nickname: string; password: string; passwordConfirm: string }) =>
      run(async () => {
        const r = await signupClickerAccount(input)
        if (!r.ok) return { tone: "error", text: r.error }
        // A new account starts with this device's run in the cloud.
        const json = getJson.current()
        if (json) await uploadCloudSave(json)
        return signedIn(r.value.account, "가입을 환영합니다. 지금 진행이 클라우드에 저장됐습니다.")
      }),
    [run, signedIn],
  )

  const logout = useCallback(
    () =>
      run(async () => {
        const json = getJson.current()
        if (json) await uploadCloudSave(json)
        await logoutClickerAccount()
        setAccount(null)
        setCloud(null)
        return { tone: "ok", text: "로그아웃했습니다. 진행은 클라우드에 저장돼 있습니다." }
      }),
    [run],
  )

  const upload = useCallback(
    () =>
      run(async () => {
        const json = getJson.current()
        if (!json) return { tone: "error", text: "저장할 진행이 없습니다." }
        const r = await uploadCloudSave(json)
        if (!r.ok) return { tone: "error", text: r.error }
        setCloud(r.value.meta)
        return { tone: "ok", text: "이 기기의 진행을 클라우드에 저장했습니다." }
      }),
    [run],
  )

  const download = useCallback(
    () =>
      run(async () => {
        const r = await fetchCloudSave()
        if (!r.ok) return { tone: "error", text: r.error }
        if (!r.value.save) return { tone: "error", text: "클라우드에 저장된 진행이 없습니다." }
        if (!apply.current(r.value.save.json)) return { tone: "error", text: "클라우드 진행을 불러오지 못했습니다." }
        return { tone: "ok", text: "클라우드 진행을 불러왔습니다." }
      }),
    [run],
  )

  // Keep the cloud copy fresh while logged in.
  const signedInId = account?.id
  useEffect(() => {
    if (!signedInId) return
    const push = (keepalive: boolean) => {
      const json = getJson.current()
      if (json) void uploadCloudSave(json, keepalive).then((r) => r.ok && setCloud(r.value.meta))
    }
    const id = window.setInterval(() => push(false), AUTO_UPLOAD_MS)
    const onHide = () => {
      if (document.visibilityState === "hidden") push(true)
    }
    document.addEventListener("visibilitychange", onHide)
    return () => {
      window.clearInterval(id)
      document.removeEventListener("visibilitychange", onHide)
    }
  }, [signedInId])

  return { available, storage, account, cloud, busy, message, login, signup, logout, upload, download }
}
