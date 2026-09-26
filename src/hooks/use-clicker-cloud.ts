"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { clickerConfig } from "@/data/clicker/catalog"
import { decideInitialSync, summarizeSave, type SaveSummary } from "@/domain/services/clicker-cloud-sync"

export type ClickerAccount = { id: string; nickname: string }
export type CloudStatus = "idle" | "syncing" | "synced" | "offline"
/** Two saves with real progress disagree; the player picks which one to keep. */
export type CloudConflict = { local: SaveSummary | null; cloud: SaveSummary; cloudRaw: string }

const UPLOAD_EVERY_MS = 30_000

type Bridge = {
  exportSaveRaw: () => string | null
  importSaveRaw: (raw: string) => void
}

async function api<T>(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  })
  const data = (await res.json().catch(() => ({}))) as T
  return { ok: res.ok, status: res.status, data }
}

const summarize = (raw: string | null) => summarizeSave(raw, clickerConfig, Date.now())

/**
 * Game-account sign-in plus cloud save. Guests keep playing on browser storage exactly as
 * before; signed-in players also upload every 30 s and when the tab is hidden.
 */
export function useClickerCloud({ exportSaveRaw, importSaveRaw }: Bridge) {
  const [account, setAccount] = useState<ClickerAccount | null>(null)
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState<CloudStatus>("idle")
  const [conflict, setConflict] = useState<CloudConflict | null>(null)
  const bridge = useRef({ exportSaveRaw, importSaveRaw })
  useEffect(() => {
    bridge.current = { exportSaveRaw, importSaveRaw }
  })
  /** savedAt of the last save the server accepted — skip uploads when nothing changed. */
  const uploadedAt = useRef(0)
  /** The cloud version this device last synced with (0 = cloud was empty). */
  const cloudAt = useRef(0)
  const inFlight = useRef(false)
  const accountRef = useRef<ClickerAccount | null>(null)
  const conflictRef = useRef<CloudConflict | null>(null)
  useEffect(() => {
    accountRef.current = account
    conflictRef.current = conflict
  })

  const showConflict = useCallback(async () => {
    const res = await api<{ save: { raw: string } | null }>("/api/clicker/save")
    const cloudRaw = res.data.save?.raw ?? null
    const cloud = summarize(cloudRaw)
    if (!cloudRaw || !cloud) return
    setConflict({ local: summarize(bridge.current.exportSaveRaw()), cloud, cloudRaw })
  }, [])

  const upload = useCallback(
    async (opts: { force?: boolean; keepalive?: boolean } = {}) => {
      if (!accountRef.current || (conflictRef.current && !opts.force) || inFlight.current) return
      const raw = bridge.current.exportSaveRaw()
      const local = summarize(raw)
      if (!raw || !local || (!opts.force && local.savedAt <= uploadedAt.current)) return
      // One upload at a time: a second one would carry a stale base and 409 against the first.
      inFlight.current = true
      setStatus("syncing")
      try {
        const res = await api<{ savedAt?: number; conflict?: boolean }>("/api/clicker/save", {
          method: "PUT",
          body: JSON.stringify({ raw, force: opts.force === true, baseSavedAt: cloudAt.current }),
          keepalive: opts.keepalive,
        })
        if (res.ok) {
          uploadedAt.current = res.data.savedAt ?? local.savedAt
          cloudAt.current = uploadedAt.current
          setStatus("synced")
        } else if (res.status === 409) {
          setStatus("idle")
          await showConflict()
        } else if (res.status === 401) {
          setAccount(null)
          setStatus("idle")
        } else {
          setStatus("offline")
        }
      } catch {
        setStatus("offline")
      } finally {
        inFlight.current = false
      }
    },
    [showConflict],
  )

  /** First sync after sign-in (or page load while signed in). */
  const reconcile = useCallback(async () => {
    setStatus("syncing")
    try {
      const res = await api<{ save: { raw: string; savedAt: number } | null }>("/api/clicker/save")
      if (!res.ok) {
        setStatus(res.status === 401 ? "idle" : "offline")
        if (res.status === 401) setAccount(null)
        return
      }
      const cloudRaw = res.data.save?.raw ?? null
      const cloud = summarize(cloudRaw)
      const local = summarize(bridge.current.exportSaveRaw())
      const action = decideInitialSync(local, cloud)
      cloudAt.current = cloud?.savedAt ?? 0
      if (action === "download" && cloudRaw) {
        bridge.current.importSaveRaw(cloudRaw)
        uploadedAt.current = cloud?.savedAt ?? 0
        setStatus("synced")
      } else if (action === "upload") {
        uploadedAt.current = 0
        setStatus("idle")
        await upload()
      } else if (action === "ask" && cloud && cloudRaw) {
        setStatus("idle")
        setConflict({ local, cloud, cloudRaw })
      } else {
        uploadedAt.current = cloud?.savedAt ?? 0
        setStatus("synced")
      }
    } catch {
      setStatus("offline")
    }
  }, [upload])

  useEffect(() => {
    let cancelled = false
    api<{ account: ClickerAccount | null }>("/api/clicker/auth/me")
      .then((res) => {
        if (cancelled) return
        setAccount(res.data.account ?? null)
        accountRef.current = res.data.account ?? null
        setReady(true)
        if (res.data.account) void reconcile()
      })
      .catch(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [reconcile])

  useEffect(() => {
    if (!account) return
    const id = window.setInterval(() => void upload(), UPLOAD_EVERY_MS)
    const onHide = () => {
      if (document.visibilityState === "hidden") void upload({ keepalive: true })
    }
    document.addEventListener("visibilitychange", onHide)
    return () => {
      window.clearInterval(id)
      document.removeEventListener("visibilitychange", onHide)
    }
  }, [account, upload])

  const signIn = useCallback(
    async (mode: "login" | "signup", nickname: string, password: string): Promise<string | null> => {
      try {
        const res = await api<{ account?: ClickerAccount; error?: string }>(`/api/clicker/auth/${mode}`, {
          method: "POST",
          body: JSON.stringify({ nickname, password }),
        })
        if (!res.ok || !res.data.account) return res.data.error ?? "요청을 처리하지 못했습니다."
        setAccount(res.data.account)
        accountRef.current = res.data.account
        await reconcile()
        return null
      } catch {
        return "서버에 연결하지 못했습니다."
      }
    },
    [reconcile],
  )

  const signOut = useCallback(async () => {
    await upload()
    await api("/api/clicker/auth/logout", { method: "POST" }).catch(() => undefined)
    setAccount(null)
    setConflict(null)
    setStatus("idle")
    uploadedAt.current = 0
    cloudAt.current = 0
  }, [upload])

  /** Resolve a conflict: keep the cloud save here, or overwrite the cloud with this device. */
  const resolveConflict = useCallback(
    async (keep: "cloud" | "local") => {
      const current = conflictRef.current
      if (!current) return
      setConflict(null)
      conflictRef.current = null
      if (keep === "cloud") {
        bridge.current.importSaveRaw(current.cloudRaw)
        uploadedAt.current = current.cloud.savedAt
        cloudAt.current = current.cloud.savedAt
        setStatus("synced")
      } else {
        await upload({ force: true })
      }
    },
    [upload],
  )

  return { account, ready, status, conflict, signIn, signOut, resolveConflict, syncNow: () => upload({ force: false }) }
}
