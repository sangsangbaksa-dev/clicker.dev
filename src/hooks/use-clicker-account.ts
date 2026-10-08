"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  fetchClickerAccount,
  fetchCloudSave,
  loginClickerAccount,
  logoutClickerAccount,
  signupClickerAccount,
  uploadCloudSave,
  clickerSaveProgress,
  readClickerSaveOwner,
  writeClickerSaveOwner,
  type ClickerAccountInfo,
  type ClickerCloudSave,
} from "@/application/clicker-account"
import { isClickerStaticHost } from "@/application/clicker-static-host"

/** While logged in, the run is copied to the cloud this often (and when the page closes). */
const AUTO_UPLOAD_MS = 2 * 60 * 1000

type Options = {
  /** Current save as stored JSON, or null before the game has loaded. */
  getSaveJson: () => string | null
  /** Replace this device's save with the cloud one. */
  applySaveJson: (json: string) => boolean
  /** Start this device on a brand-new run (the old one is backed up first). */
  startFresh: () => void
}

export type ClickerAccountState = ReturnType<typeof useClickerAccount>

export function useClickerAccount({ getSaveJson, applySaveJson, startFresh }: Options) {
  /** The first account check has answered (until then `available` is unknown). */
  const [checked, setChecked] = useState(false)
  const [available, setAvailable] = useState(false)
  /** A session cookie was already valid when the page loaded. */
  const [signedInAtBoot, setSignedInAtBoot] = useState(false)
  const [storage, setStorage] = useState(true)
  const [account, setAccount] = useState<ClickerAccountInfo | null>(null)
  const [cloud, setCloud] = useState<ClickerCloudSave["meta"] | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null)
  const getJson = useRef(getSaveJson)
  const apply = useRef(applySaveJson)
  const fresh = useRef(startFresh)
  useEffect(() => {
    getJson.current = getSaveJson
    apply.current = applySaveJson
    fresh.current = startFresh
  })

  const refreshCloud = useCallback(async () => {
    const r = await fetchCloudSave()
    const meta = r.ok ? (r.value.save?.meta ?? null) : null
    setCloud(meta)
    return meta
  }, [])

  useEffect(() => {
    if (isClickerStaticHost()) {
      setAvailable(false)
      setStorage(false)
      setChecked(true)
      return
    }
    let alive = true
    // A slow or hung account server must not hold the game behind the boot screen.
    const giveUp = window.setTimeout(() => alive && setChecked(true), 5000)
    fetchClickerAccount().then((r) => {
      if (!alive) return
      setAvailable(r.available)
      setStorage(r.storage)
      setAccount(r.account)
      setSignedInAtBoot(Boolean(r.account))
      setChecked(true)
      if (r.account) {
        if (!readClickerSaveOwner()) writeClickerSaveOwner(r.account.id)
        void refreshCloud()
      }
    })
    return () => {
      alive = false
      window.clearTimeout(giveUp)
    }
  }, [refreshCloud])

  /** Runs one account job; resolves true when it succeeded. */
  const run = useCallback(async (job: () => Promise<{ tone: "ok" | "error"; text: string } | null>) => {
    setBusy(true)
    setMessage(null)
    try {
      const result = await job()
      setMessage(result)
      return result?.tone !== "error"
    } finally {
      setBusy(false)
    }
  }, [])

  /**
   * After a login, decide which run this device continues. The device's run may belong to
   * another account (someone logged out here): it is never uploaded into this one — the cloud
   * run is loaded, or a fresh run starts. Otherwise the run with more total CORE wins.
   */
  const syncAfterLogin = useCallback(
    async (next: ClickerAccountInfo): Promise<string> => {
      const owner = readClickerSaveOwner()
      const foreign = owner !== null && owner !== next.id
      const local = getJson.current()
      const r = await fetchCloudSave()
      const cloudSave = r.ok ? r.value.save : null
      writeClickerSaveOwner(next.id)
      if (cloudSave && (foreign || !local || clickerSaveProgress(cloudSave.json) > clickerSaveProgress(local))) {
        setCloud(cloudSave.meta)
        return apply.current(cloudSave.json) ? "클라우드 진행을 불러왔습니다." : "클라우드 진행을 불러오지 못했습니다."
      }
      if (foreign) {
        fresh.current()
        setCloud(cloudSave?.meta ?? null)
        return "이 계정의 새 진행으로 시작합니다."
      }
      if (!local) return "진행을 이어 갑니다."
      const up = await uploadCloudSave(local)
      if (up.ok) setCloud(up.value.meta)
      return up.ok ? "이 기기의 진행을 클라우드에 저장했습니다." : up.error
    },
    [],
  )

  const login = useCallback(
    (loginId: string, password: string) =>
      run(async () => {
        const r = await loginClickerAccount(loginId, password)
        if (!r.ok) return { tone: "error", text: r.error }
        setAccount(r.value.account)
        const synced = await syncAfterLogin(r.value.account)
        return { tone: "ok", text: `${r.value.account.nickname}님, 환영합니다. ${synced}` }
      }),
    [run, syncAfterLogin],
  )

  const signup = useCallback(
    (input: { loginId: string; nickname: string; password: string; passwordConfirm: string }) =>
      run(async () => {
        const r = await signupClickerAccount(input)
        if (!r.ok) return { tone: "error", text: r.error }
        setAccount(r.value.account)
        // A new account takes this device's run along — unless that run is another account's.
        const synced = await syncAfterLogin(r.value.account)
        return { tone: "ok", text: `${r.value.account.nickname}님, 가입을 환영합니다. ${synced}` }
      }),
    [run, syncAfterLogin],
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
        if (r.value.meta.kept) return { tone: "error", text: "클라우드에 누적 CORE가 더 높은 진행이 있어 그대로 두었습니다. 불러오려면 「클라우드에서 불러오기」를 누르세요." }
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

  const clearMessage = useCallback(() => setMessage(null), [])

  /** Quiet upload (no status message): e.g. right after the ending so the ranking sees the clear. */
  const pushNow = useCallback(async (): Promise<boolean> => {
    if (!signedInId) return false
    const json = getJson.current()
    if (!json) return false
    const r = await uploadCloudSave(json)
    if (r.ok) setCloud(r.value.meta)
    return r.ok
  }, [signedInId])

  return { clearMessage, checked, signedInAtBoot, available, storage, account, cloud, busy, message, login, signup, logout, upload, download, pushNow }
}
