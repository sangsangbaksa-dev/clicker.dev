"use client"

import {
  canEditSchoolNoteKind,
  canEditSchoolNotes,
} from "@/domain/services/access-level"
import { mergeSchoolNotesOnConflict } from "@/domain/services/conflict-merge"
import { refreshAuthSession } from "@/hooks/use-auth"
import { SYNC_VISIBLE_MS, TEXT_SAVE_DEBOUNCE_MS } from "@/shared/sync"
import type { AuthUser, SchoolNotesDocument, SchoolNoteKind } from "@/domain/entities/board"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

type SaveState = "saved" | "saving" | "offline"

const fetchOpts: RequestInit = {
  credentials: "same-origin",
  cache: "no-store",
}

function mergeLocalOnConflict(
  local: SchoolNotesDocument,
  remote: SchoolNotesDocument,
  base: SchoolNotesDocument
): SchoolNotesDocument {
  return mergeSchoolNotesOnConflict(local, remote, base)
}

export function useSchoolNotes(
  user: AuthUser | null,
  options?: { enabled?: boolean }
) {
  const enabled = options?.enabled ?? true
  const [doc, setDoc] = useState<SchoolNotesDocument | null>(null)
  const [saveState, setSaveState] = useState<SaveState>("saved")
  const docRef = useRef<SchoolNotesDocument | null>(null)
  const lastSyncedRef = useRef<SchoolNotesDocument | null>(null)
  const dirtyRef = useRef(false)
  const saveTimer = useRef<number | null>(null)
  const inFlight = useRef(false)

  const canEdit = useMemo(
    () => (user ? canEditSchoolNotes(user) : false),
    [user]
  )
  const canEditRef = useRef(canEdit)

  useEffect(() => {
    docRef.current = doc
  }, [doc])

  useEffect(() => {
    canEditRef.current = canEdit
    if (canEdit) return
    dirtyRef.current = false
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    setSaveState("saved")
  }, [canEdit])

  const load = useCallback(async (quiet = false) => {
    if (dirtyRef.current) return
    try {
      const res = await fetch("/api/school-notes", fetchOpts)
      const payload = (await res.json()) as {
        schoolNotes?: SchoolNotesDocument
        error?: string
      }
      if (!res.ok || !payload.schoolNotes) {
        throw new Error(payload.error ?? "전교 노트를 불러오지 못했습니다.")
      }
      if (dirtyRef.current) return
      lastSyncedRef.current = payload.schoolNotes
      docRef.current = payload.schoolNotes
      setDoc(payload.schoolNotes)
    } catch (error) {
      if (quiet) return
      const message = error instanceof Error ? error.message : "전교 노트를 불러오지 못했습니다."
      toast.error(message)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    void load()
  }, [enabled, load])

  useEffect(() => {
    if (!enabled) return
    function poll() {
      if (document.visibilityState === "hidden") return
      if (dirtyRef.current || inFlight.current) return
      void load(true)
    }
    const timer = window.setInterval(poll, SYNC_VISIBLE_MS)
    function onVisible() {
      if (document.visibilityState === "visible") poll()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [enabled, load])

  // Retries re-enter through the ref so they always run the latest flushSave.
  const flushSaveRef = useRef<() => Promise<void>>(async () => {})
  const flushSave = useCallback(async () => {
    const current = docRef.current
    if (!current || !canEditRef.current || !dirtyRef.current || inFlight.current) return

    inFlight.current = true
    setSaveState("saving")

    try {
      const res = await fetch("/api/school-notes", {
        ...fetchOpts,
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolNotes: { notes: current.notes },
          revision: current.revision,
        }),
      })
      const payload = (await res.json()) as {
        schoolNotes?: SchoolNotesDocument
        error?: string
        conflict?: boolean
      }

      if (res.status === 409 && payload.schoolNotes) {
        const local = docRef.current ?? current
        const base = lastSyncedRef.current ?? payload.schoolNotes
        const merged = mergeLocalOnConflict(local, payload.schoolNotes, base)
        lastSyncedRef.current = payload.schoolNotes
        docRef.current = merged
        setDoc(merged)
        dirtyRef.current = true
        toast.message("다른 사용자가 먼저 저장했습니다. 다시 저장합니다.")
        inFlight.current = false
        setSaveState("saving")
        window.setTimeout(() => {
          void flushSaveRef.current()
        }, 700)
        return
      }

      if (res.status === 422) {
        dirtyRef.current = false
        await Promise.all([load(), refreshAuthSession()])
        setSaveState("saved")
        toast.error(payload.error ?? "부적절한 표현이 감지되어 저장하지 않았습니다.")
        return
      }

      if (!res.ok || !payload.schoolNotes) {
        throw new Error(payload.error ?? "저장하지 못했습니다.")
      }

      lastSyncedRef.current = payload.schoolNotes
      docRef.current = payload.schoolNotes
      setDoc(payload.schoolNotes)
      dirtyRef.current = false
      setSaveState("saved")
    } catch {
      setSaveState("offline")
    } finally {
      inFlight.current = false
      if (dirtyRef.current && canEditRef.current) {
        window.setTimeout(() => {
          void flushSaveRef.current()
        }, 700)
      }
    }
  }, [load])
  useLayoutEffect(() => {
    flushSaveRef.current = flushSave
  })

  const scheduleSave = useCallback(() => {
    if (!canEditRef.current) return
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

  const canEditSchoolNote = useCallback(
    (kind: SchoolNoteKind) => (user ? canEditSchoolNoteKind(user, kind) : false),
    [user]
  )

  const updateSchoolNote = useCallback(
    (kind: SchoolNoteKind, value: string) => {
      if (!user || !canEditSchoolNoteKind(user, kind)) return
      setDoc((prev) => {
        if (!prev) return prev
        const next = {
          ...prev,
          notes: { ...prev.notes, [kind]: value },
        }
        docRef.current = next
        return next
      })
      scheduleSave()
    },
    [scheduleSave, user]
  )

  return {
    schoolNotes: doc?.notes ?? null,
    schoolRevision: doc?.revision ?? null,
    saveState,
    canEditSchoolNotes: canEdit,
    canEditSchoolNote,
    updateSchoolSubjectNote: updateSchoolNote,
    reloadSchoolNotes: load,
  }
}
