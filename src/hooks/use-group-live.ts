"use client"

import type { GroupChatView } from "@/application/group-chat"
import type { GroupLiveView } from "@/application/group-collab"
import type { GroupDocsView } from "@/application/group-docs"
import type { GroupDocument, GroupTyping } from "@/domain/entities/board"
import { mergeDocumentsOnConflict } from "@/domain/services/group-docs"
import { refreshAuthSession } from "@/hooks/use-auth"
import { SYNC_HIDDEN_MS, SYNC_VISIBLE_MS, TEXT_SAVE_DEBOUNCE_MS } from "@/shared/sync"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { toast } from "sonner"

type SaveState = "saved" | "saving" | "offline"

const fetchOpts: RequestInit = {
  credentials: "same-origin",
  cache: "no-store",
}

function liveUrl(roomCode: string, groupId: string, docsStamp?: string, chatStamp?: string) {
  const base = `/api/rooms/${encodeURIComponent(roomCode)}/groups/${encodeURIComponent(groupId)}/live`
  const params = new URLSearchParams()
  if (docsStamp) params.set("docs", docsStamp)
  if (chatStamp) params.set("chat", chatStamp)
  const query = params.toString()
  return query ? `${base}?${query}` : base
}

function docsUrl(roomCode: string, groupId: string) {
  return `/api/rooms/${encodeURIComponent(roomCode)}/groups/${encodeURIComponent(groupId)}/documents`
}

function docUrl(roomCode: string, groupId: string, documentId: string) {
  return `${docsUrl(roomCode, groupId)}/${encodeURIComponent(documentId)}`
}

function chatUrl(roomCode: string, groupId: string) {
  return `/api/rooms/${encodeURIComponent(roomCode)}/groups/${encodeURIComponent(groupId)}/messages`
}

const emptyChat = (groupId: string): GroupChatView => ({
  groupId,
  title: "조 대화",
  label: "",
  canPost: false,
  messages: [],
})

export function useGroupLive(roomCode: string, groupId: string | null) {
  const [docs, setDocs] = useState<GroupDocsView | null>(null)
  const [chat, setChat] = useState<GroupChatView | null>(null)
  const [typing, setTyping] = useState<GroupTyping[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>("saved")
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "forbidden" | "missing">("loading")

  const docsRef = useRef<GroupDocsView | null>(null)
  const lastSyncedDocsRef = useRef<GroupDocsView | null>(null)
  const docsStampRef = useRef("")
  const chatStampRef = useRef("")
  const dirtyRef = useRef(false)
  const saveTimer = useRef<number | null>(null)
  const inFlight = useRef(false)
  const activeIdRef = useRef<string | null>(null)
  const typingTimer = useRef<number | null>(null)

  useEffect(() => {
    docsRef.current = docs
  }, [docs])

  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  const applyLive = useCallback((payload: GroupLiveView, mergeDocs: boolean) => {
    docsStampRef.current = payload.docsStamp
    chatStampRef.current = payload.chatStamp
    setTyping(payload.typing)
    if (!payload.unchanged) {
      if (payload.chat.messages) setChat(payload.chat)
      if (payload.documents.length > 0 || !docsRef.current) {
        const incoming: GroupDocsView = {
          groupId: payload.groupId,
          label: payload.label,
          canEdit: payload.canEdit,
          documents: payload.documents,
        }
        if (mergeDocs && docsRef.current && lastSyncedDocsRef.current) {
          incoming.documents = mergeDocumentsOnConflict(
            docsRef.current.documents,
            payload.documents,
            lastSyncedDocsRef.current.documents
          )
        } else {
          lastSyncedDocsRef.current = incoming
        }
        docsRef.current = incoming
        setDocs(incoming)
        setActiveId((current) => {
          if (current && incoming.documents.some((item) => item.id === current)) return current
          return incoming.documents[0]?.id ?? null
        })
      }
    }
    setError(null)
    setStatus("ready")
  }, [])

  const load = useCallback(
    async (quiet = false) => {
      if (!groupId) return
      try {
        const res = await fetch(
          liveUrl(roomCode, groupId, docsStampRef.current, chatStampRef.current),
          fetchOpts
        )
        const payload = (await res.json()) as GroupLiveView & { error?: string }
        if (res.status === 403) {
          setStatus("forbidden")
          setError(payload.error ?? "이 조 조원만 문서와 대화를 볼 수 있습니다.")
          setDocs(null)
          setChat(null)
          return
        }
        if (res.status === 404) {
          setStatus("missing")
          setError(payload.error ?? "조를 찾을 수 없습니다.")
          setDocs(null)
          setChat(null)
          return
        }
        if (!res.ok) throw new Error(payload.error ?? "불러오지 못했습니다.")
        applyLive(payload, dirtyRef.current)
      } catch (err) {
        if (quiet) return
        const message = err instanceof Error ? err.message : "불러오지 못했습니다."
        setError(message)
        toast.error(message)
      }
    },
    [applyLive, groupId, roomCode]
  )

  useEffect(() => {
    dirtyRef.current = false
    lastSyncedDocsRef.current = null
    docsRef.current = null
    docsStampRef.current = ""
    chatStampRef.current = ""
    setDocs(null)
    setChat(groupId ? emptyChat(groupId) : null)
    setTyping([])
    setActiveId(null)
    setSaveState("saved")
    setError(null)
    setStatus(groupId ? "loading" : "missing")
    if (groupId) void load()
  }, [groupId, load])

  // Retries re-enter through the ref so they always run the latest flushSave.
  const flushSaveRef = useRef<() => Promise<void>>(async () => {})
  const flushSave = useCallback(async () => {
    const current = docsRef.current
    const documentId = activeIdRef.current
    if (!groupId || !current || !documentId || !current.canEdit) return
    if (!dirtyRef.current || inFlight.current) return
    const paper = current.documents.find((item) => item.id === documentId)
    if (!paper) return

    inFlight.current = true
    setSaveState("saving")

    try {
      const res = await fetch(docUrl(roomCode, groupId, documentId), {
        ...fetchOpts,
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: paper.title,
          body: paper.body,
          revision: paper.revision,
        }),
      })
      const payload = (await res.json()) as GroupDocsView & { error?: string; conflict?: boolean }

      if (res.status === 409 && payload.documents) {
        const local = docsRef.current ?? current
        const base = lastSyncedDocsRef.current ?? payload
        const mergedDocs = mergeDocumentsOnConflict(local.documents, payload.documents, base.documents)
        const merged: GroupDocsView = { ...payload, documents: mergedDocs }
        lastSyncedDocsRef.current = payload
        docsRef.current = merged
        setDocs(merged)
        dirtyRef.current = true
        inFlight.current = false
        setSaveState("saving")
        window.setTimeout(() => {
          void flushSaveRef.current()
        }, 400)
        return
      }

      if (res.status === 422) {
        dirtyRef.current = false
        await Promise.all([load(), refreshAuthSession()])
        setSaveState("saved")
        toast.error(payload.error ?? "부적절한 표현이 감지되어 저장하지 않았습니다.")
        return
      }

      if (!res.ok || !payload.documents) {
        throw new Error(payload.error ?? "저장하지 못했습니다.")
      }

      lastSyncedDocsRef.current = payload
      docsRef.current = payload
      setDocs(payload)
      dirtyRef.current = false
      setSaveState("saved")
    } catch {
      setSaveState("offline")
    } finally {
      inFlight.current = false
      if (dirtyRef.current && docsRef.current?.canEdit) {
        window.setTimeout(() => {
          void flushSaveRef.current()
        }, 400)
      }
    }
  }, [groupId, load, roomCode])
  useLayoutEffect(() => {
    flushSaveRef.current = flushSave
  })

  const scheduleSave = useCallback(() => {
    if (!docsRef.current?.canEdit) return
    dirtyRef.current = true
    setSaveState("saving")
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      void flushSave()
    }, TEXT_SAVE_DEBOUNCE_MS)
  }, [flushSave])

  const flushPendingSave = useCallback(() => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    void flushSave()
  }, [flushSave])

  const pingTyping = useCallback(
    (surface: "docs" | "chat") => {
      if (!groupId || !docsRef.current?.canEdit) return
      if (typingTimer.current) return
      typingTimer.current = window.setTimeout(() => {
        typingTimer.current = null
      }, 2_000)
      void fetch(liveUrl(roomCode, groupId), {
        ...fetchOpts,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surface }),
      })
        .then((res) => res.json())
        .then((body: { typing?: GroupTyping[] }) => {
          if (Array.isArray(body.typing)) setTyping(body.typing)
        })
        .catch(() => undefined)
    },
    [groupId, roomCode]
  )

  const patchActive = useCallback(
    (patch: Partial<Pick<GroupDocument, "title" | "body">>) => {
      const documentId = activeIdRef.current
      if (!documentId || !docsRef.current?.canEdit) return
      setDocs((prev) => {
        if (!prev) return prev
        const next: GroupDocsView = {
          ...prev,
          documents: prev.documents.map((item) =>
            item.id === documentId ? { ...item, ...patch } : item
          ),
        }
        docsRef.current = next
        return next
      })
      pingTyping("docs")
      scheduleSave()
    },
    [pingTyping, scheduleSave]
  )

  const selectDocument = useCallback(
    (documentId: string) => {
      if (documentId === activeIdRef.current) return
      flushPendingSave()
      setActiveId(documentId)
    },
    [flushPendingSave]
  )

  const createDocument = useCallback(async () => {
    if (!groupId || !docsRef.current?.canEdit) return
    flushPendingSave()
    try {
      const res = await fetch(docsUrl(roomCode, groupId), { ...fetchOpts, method: "POST" })
      const payload = (await res.json()) as GroupDocsView & { error?: string }
      if (!res.ok || !payload.documents) throw new Error(payload.error ?? "문서를 만들지 못했습니다.")
      lastSyncedDocsRef.current = payload
      docsRef.current = payload
      dirtyRef.current = false
      setDocs(payload)
      setSaveState("saved")
      const created = payload.documents[payload.documents.length - 1]
      if (created) setActiveId(created.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "문서를 만들지 못했습니다.")
    }
  }, [flushPendingSave, groupId, roomCode])

  const deleteDocument = useCallback(
    async (documentId: string) => {
      if (!groupId || !docsRef.current?.canEdit) return
      flushPendingSave()
      try {
        const res = await fetch(docUrl(roomCode, groupId, documentId), {
          ...fetchOpts,
          method: "DELETE",
        })
        const payload = (await res.json()) as GroupDocsView & { error?: string }
        if (!res.ok || !payload.documents) throw new Error(payload.error ?? "문서를 지우지 못했습니다.")
        lastSyncedDocsRef.current = payload
        docsRef.current = payload
        dirtyRef.current = false
        setDocs(payload)
        setSaveState("saved")
        setActiveId((current) => {
          if (current && payload.documents.some((item) => item.id === current)) return current
          return payload.documents[0]?.id ?? null
        })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "문서를 지우지 못했습니다.")
      }
    },
    [flushPendingSave, groupId, roomCode]
  )

  const sendChat = useCallback(
    async (body: string, image?: File | null) => {
      if (!groupId || !chat?.canPost) return false
      const trimmed = body.trim()
      if (!trimmed && !image) return false
      pingTyping("chat")
      try {
        let res: Response
        if (image) {
          const form = new FormData()
          form.set("body", trimmed)
          form.set("image", image)
          res = await fetch(chatUrl(roomCode, groupId), { ...fetchOpts, method: "POST", body: form })
        } else {
          res = await fetch(chatUrl(roomCode, groupId), {
            ...fetchOpts,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ body: trimmed }),
          })
        }
        const payload = (await res.json()) as GroupChatView & { error?: string }
        if (res.status === 422) {
          await refreshAuthSession()
          toast.error(payload.error ?? "부적절한 표현이 감지되어 보내지 않았습니다.")
          return false
        }
        if (!res.ok || !payload.messages) throw new Error(payload.error ?? "보내지 못했습니다.")
        setChat(payload)
        chatStampRef.current = `${payload.messages.length}:${payload.messages.at(-1)?.id ?? ""}`
        return true
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "보내지 못했습니다.")
        return false
      }
    },
    [chat?.canPost, groupId, pingTyping, roomCode]
  )

  useEffect(() => {
    function onPageHide() {
      flushPendingSave()
    }
    window.addEventListener("pagehide", onPageHide)
    return () => {
      window.removeEventListener("pagehide", onPageHide)
      flushPendingSave()
    }
  }, [flushPendingSave])

  useEffect(() => {
    if (!groupId) return
    let timer: number | null = null
    function schedule() {
      if (timer) window.clearTimeout(timer)
      const delay = document.visibilityState === "hidden" ? SYNC_HIDDEN_MS : SYNC_VISIBLE_MS
      timer = window.setTimeout(() => {
        if (document.visibilityState !== "hidden") void load(true)
        schedule()
      }, delay)
    }
    schedule()
    function onVisible() {
      if (document.visibilityState === "visible") void load(true)
      schedule()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      if (timer) window.clearTimeout(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [groupId, load])

  const active = docs?.documents.find((item) => item.id === activeId) ?? null

  return {
    docs,
    chat,
    typing,
    active,
    status,
    error,
    saveState,
    canEdit: Boolean(docs?.canEdit),
    selectDocument,
    patchActive,
    createDocument,
    deleteDocument,
    sendChat,
  }
}
