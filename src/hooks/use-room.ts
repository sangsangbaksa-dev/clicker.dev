"use client"

import { refreshAuthSession } from "@/hooks/use-auth"
import {
  canAccessRoomFeed,
  canEditRoomContent,
  canPostRoomUpdates,
} from "@/domain/services/access-level"
import { mergeRoomOnConflict } from "@/domain/services/conflict-merge"
import { createId, normalizeRoomCode } from "@/shared/ids"
import {
  DEFAULT_SAVE_DEBOUNCE_MS,
  HEARTBEAT_MS,
  SYNC_HIDDEN_MS,
  SYNC_VISIBLE_MS,
  TEXT_SAVE_DEBOUNCE_MS,
} from "@/shared/sync"
import type { AuthUser, Member, Room } from "@/domain/entities/board"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

type RoomStatus = "loading" | "ready" | "missing" | "error"
type SaveState = "saved" | "saving" | "offline"

type RoomApiPayload = {
  room?: Room
  error?: string
  conflict?: boolean
  contentHold?: boolean
  unchanged?: boolean
  revision?: number
  members?: Member[]
}

const fetchOpts: RequestInit = {
  credentials: "same-origin",
  cache: "no-store",
}

async function parseResponse(response: Response): Promise<RoomApiPayload> {
  try {
    return (await response.json()) as RoomApiPayload
  } catch {
    return { error: "서버 응답을 읽지 못했습니다." }
  }
}

function membersChanged(local: Member[], remote: Member[]): boolean {
  if (local.length !== remote.length) return true
  return remote.some((member, index) => {
    const prev = local[index]
    return (
      !prev ||
      prev.id !== member.id ||
      prev.lastSeenAt !== member.lastSeenAt ||
      prev.name !== member.name ||
      prev.role !== member.role
    )
  })
}

function applyMembers(prev: Room, members: Member[]): Room {
  if (!membersChanged(prev.members, members)) return prev
  return { ...prev, members }
}

/** Apply server room snapshot when revision is same or newer (never clobber dirty local edits). */
function applyRemoteRoomSnapshot(
  local: Room,
  remote: Room,
  setRoomSafe: (next: Room) => void,
  mergeMembers: (members: Member[]) => void,
  rememberSynced: (next: Room) => void
) {
  if (remote.revision > local.revision) {
    rememberSynced(remote)
    setRoomSafe(remote)
    return
  }
  if (remote.revision === local.revision) {
    mergeMembers(remote.members)
  }
}

/** On 409, keep unsaved local drafts and adopt the other computer's saved fields. */
function mergeLocalEditsOnConflict(local: Room, remote: Room, base: Room): Room {
  return mergeRoomOnConflict(local, remote, base)
}

export function useRoom(
  code: string,
  user: AuthUser | null,
  initialRoom: Room | null = null
) {
  const [room, setRoom] = useState<Room | null>(initialRoom)
  const [status, setStatus] = useState<RoomStatus>(initialRoom ? "ready" : "loading")
  const [saveState, setSaveState] = useState<SaveState>("saved")
  const [error, setError] = useState<string | null>(null)

  const canEdit = useMemo(
    () => (user && room ? canEditRoomContent(user, room) : false),
    [user, room]
  )
  const canAccessFeed = useMemo(
    () => (user && room ? canAccessRoomFeed(user, room) : false),
    [user, room]
  )
  const canPostUpdates = useMemo(
    () => (user && room ? canPostRoomUpdates(user, room) : false),
    [user, room]
  )

  const roomRef = useRef<Room | null>(null)
  const lastSyncedRef = useRef<Room | null>(initialRoom)
  const dirtyRef = useRef(false)
  const saveTimer = useRef<number | null>(null)
  const pendingDebounceMs = useRef(DEFAULT_SAVE_DEBOUNCE_MS)
  const inFlight = useRef(false)
  const canEditRef = useRef(canEdit)
  const permissionToastShown = useRef(false)
  const lastHeartbeatAt = useRef(0)

  useEffect(() => {
    roomRef.current = room
  }, [room])

  // Losing edit rights drops any pending save, so the badge goes back to "saved".
  const [prevCanEdit, setPrevCanEdit] = useState(canEdit)
  if (prevCanEdit !== canEdit) {
    setPrevCanEdit(canEdit)
    if (!canEdit) setSaveState("saved")
  }

  useEffect(() => {
    canEditRef.current = canEdit
    if (canEdit) return
    dirtyRef.current = false
    permissionToastShown.current = false
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
  }, [canEdit])

  const setRoomSafe = useCallback((next: Room | null) => {
    roomRef.current = next
    setRoom(next)
  }, [])

  const rememberSynced = useCallback((next: Room) => {
    lastSyncedRef.current = next
  }, [])

  const mergeMembers = useCallback((members: Member[]) => {
    setRoom((prev) => {
      if (!prev) return prev
      const next = applyMembers(prev, members)
      if (next === prev) return prev
      roomRef.current = next
      return next
    })
  }, [])

  async function reloadRoom(current: Room): Promise<Room | null> {
    try {
      const response = await fetch(`/api/rooms/${current.code}`, fetchOpts)
      const payload = await parseResponse(response)
      if (!response.ok || !payload.room) return null
      rememberSynced(payload.room)
      roomRef.current = payload.room
      setRoom(payload.room)
      return payload.room
    } catch {
      return null
    }
  }

  function persist(options?: { keepalive?: boolean }) {
    const current = roomRef.current
    if (!current || !canEditRef.current || !dirtyRef.current || inFlight.current) return
    inFlight.current = true
    setSaveState("saving")
    void (async () => {
      try {
        const response = await fetch(`/api/rooms/${current.code}`, {
          ...fetchOpts,
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room: current, revision: current.revision }),
          keepalive: options?.keepalive ?? false,
        })
        const payload = await parseResponse(response)
        if (response.status === 409 && payload.room) {
          const local = roomRef.current ?? current
          const base = lastSyncedRef.current ?? payload.room
          const merged = mergeLocalEditsOnConflict(local, payload.room, base)
          rememberSynced(payload.room)
          roomRef.current = merged
          setRoom(merged)
          dirtyRef.current = true
          setSaveState("saving")
          toast.message("다른 사용자가 먼저 저장했습니다. 다시 저장합니다.")
          return
        }
        if (response.status === 422) {
          dirtyRef.current = false
          await Promise.all([reloadRoom(current), refreshAuthSession()])
          setSaveState("saved")
          toast.error(payload.error ?? "부적절한 표현이 감지되어 저장하지 않았습니다.")
          return
        }
        if (response.status === 401 || response.status === 403) {
          dirtyRef.current = false
          await Promise.all([reloadRoom(current), refreshAuthSession()])
          setSaveState("saved")
          if (!permissionToastShown.current) {
            permissionToastShown.current = true
            toast.error(payload.error ?? "이 반 내용을 수정할 권한이 없습니다.")
          }
          return
        }
        if (!response.ok || !payload.room) {
          throw new Error(payload.error ?? "저장하지 못했습니다.")
        }
        dirtyRef.current = false
        rememberSynced(payload.room)
        roomRef.current = payload.room
        setRoom(payload.room)
        setSaveState("saved")
      } catch (err) {
        setSaveState("offline")
        toast.error(err instanceof Error ? err.message : "저장에 실패했습니다.")
      } finally {
        inFlight.current = false
        if (dirtyRef.current && canEditRef.current) {
          window.setTimeout(() => persist(), 700)
        }
      }
    })()
  }

  function scheduleSave(debounceMs = pendingDebounceMs.current) {
    if (!canEditRef.current) return
    dirtyRef.current = true
    setSaveState("saving")
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => persist(), debounceMs)
  }

  function flushPendingSave(options?: { keepalive?: boolean }) {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    persist(options)
  }

  // updateRoom and the pagehide handler are created once, so they reach the save helpers
  // through refs that always hold this render's versions.
  const scheduleSaveRef = useRef(scheduleSave)
  const flushPendingSaveRef = useRef(flushPendingSave)
  useLayoutEffect(() => {
    scheduleSaveRef.current = scheduleSave
    flushPendingSaveRef.current = flushPendingSave
  })

  const updateRoom = useCallback(
    (
      updater: (current: Room) => Room,
      options?: { debounceMs?: number; textField?: boolean }
    ) => {
      if (!canEditRef.current) return
      pendingDebounceMs.current =
        options?.debounceMs ??
        (options?.textField ? TEXT_SAVE_DEBOUNCE_MS : DEFAULT_SAVE_DEBOUNCE_MS)
      setRoom((current) => {
        if (!current) return current
        const next = updater(current)
        roomRef.current = next
        return next
      })
      scheduleSaveRef.current(pendingDebounceMs.current)
    },
    []
  )

  const initialRoomRef = useRef(initialRoom)
  // Layout effects run before the passive load effect below, so it reads the latest seed.
  useLayoutEffect(() => {
    initialRoomRef.current = initialRoom
  })
  const initialRoomKey =
    initialRoom && normalizeRoomCode(initialRoom.code) === normalizeRoomCode(code)
      ? `${initialRoom.code}:${initialRoom.revision}`
      : null

  useEffect(() => {
    let cancelled = false
    const normalized = normalizeRoomCode(code)

    async function load() {
      const seed = initialRoomRef.current
      const hasInitial =
        Boolean(initialRoomKey) &&
        Boolean(seed) &&
        normalizeRoomCode(seed?.code ?? "") === normalized
      if (hasInitial && seed) {
        if (!dirtyRef.current && !inFlight.current) {
          rememberSynced(seed)
          roomRef.current = seed
          setRoom(seed)
        }
        setStatus("ready")
        setError(null)
        return
      }
      setStatus("loading")
      setError(null)
      try {
        const response = await fetch(`/api/rooms/${normalized}`, fetchOpts)
        const payload = await parseResponse(response)
        if (cancelled) return
        if (response.status === 404) {
          setStatus("missing")
          setRoomSafe(null)
          return
        }
        if (response.status === 401 || response.status === 403) {
          setStatus("error")
          setError(payload.error ?? "승인된 회원만 볼 수 있습니다.")
          setRoomSafe(null)
          return
        }
        if (!response.ok || !payload.room) {
          throw new Error(payload.error ?? "화산중을 불러오지 못했습니다.")
        }
        if (dirtyRef.current || inFlight.current) {
          setStatus("ready")
          return
        }
        rememberSynced(payload.room)
        setRoomSafe(payload.room)
        setStatus("ready")
      } catch (err) {
        if (cancelled) return
        setStatus("error")
        setError(err instanceof Error ? err.message : "연결에 실패했습니다.")
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [code, initialRoomKey, setRoomSafe, rememberSynced])

  // Keyed on the id, so a refreshed user object doesn't restart presence.
  const userId = user?.id
  useEffect(() => {
    if (status !== "ready" || !userId) return
    const current = roomRef.current
    if (!current) return
    const already = current.members.some((member) => member.id === userId)
    void fetch(`/api/rooms/${current.code}`, {
      ...fetchOpts,
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: already ? "heartbeat" : "join",
      }),
    })
      .then(parseResponse)
      .then((payload) => {
        if (dirtyRef.current || inFlight.current) return
        const local = roomRef.current
        if (!local) return
        if (payload.room) {
          applyRemoteRoomSnapshot(local, payload.room, setRoomSafe, mergeMembers, rememberSynced)
          return
        }
        if (payload.members) {
          mergeMembers(payload.members)
        }
      })
      .catch(() => undefined)
    lastHeartbeatAt.current = Date.now()
  }, [userId, status, mergeMembers, setRoomSafe, rememberSynced])

  useEffect(() => {
    if (status !== "ready") return

    async function sendHeartbeat() {
      const current = roomRef.current
      if (!current || !userId) return
      if (Date.now() - lastHeartbeatAt.current < HEARTBEAT_MS - 500) return
      lastHeartbeatAt.current = Date.now()
      try {
        const payload = await parseResponse(
          await fetch(`/api/rooms/${current.code}`, {
            ...fetchOpts,
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "heartbeat" }),
          })
        )
        if (dirtyRef.current || inFlight.current) return
        if (payload.members) {
          mergeMembers(payload.members)
          return
        }
        if (payload.room) {
          const local = roomRef.current
          if (local) {
            applyRemoteRoomSnapshot(local, payload.room, setRoomSafe, mergeMembers, rememberSynced)
          }
        }
      } catch {
        // presence hiccup
      }
    }

    async function pollRevision() {
      const current = roomRef.current
      if (!current || inFlight.current) return
      try {
        const response = await fetch(
          `/api/rooms/${current.code}?revision=${current.revision}`,
          fetchOpts
        )
        const payload = await parseResponse(response)
        if (!payload || inFlight.current) return

        const local = roomRef.current
        if (!local) return

        if (payload.unchanged && payload.members) {
          if (!dirtyRef.current) mergeMembers(payload.members)
          return
        }

        if (payload.room) {
          if (payload.room.revision > local.revision) {
            if (dirtyRef.current) {
              const base = lastSyncedRef.current ?? payload.room
              const merged = mergeRoomOnConflict(local, payload.room, base)
              rememberSynced(payload.room)
              setRoomSafe(merged)
              return
            }
            rememberSynced(payload.room)
            setRoomSafe(payload.room)
            return
          }
          if (payload.room.revision === local.revision && !dirtyRef.current) {
            mergeMembers(payload.room.members)
          }
        }
      } catch {
        // polling hiccup — not a save failure
      }
    }

    void pollRevision()
    void sendHeartbeat()

    let pollTimer: number | null = null
    let beatTimer: number | null = null

    function schedulePoll() {
      if (pollTimer) window.clearTimeout(pollTimer)
      const delay =
        document.visibilityState === "hidden" ? SYNC_HIDDEN_MS : SYNC_VISIBLE_MS
      pollTimer = window.setTimeout(() => {
        void pollRevision().finally(schedulePoll)
      }, delay)
    }

    function scheduleBeat() {
      if (beatTimer) window.clearTimeout(beatTimer)
      beatTimer = window.setTimeout(() => {
        void sendHeartbeat().finally(scheduleBeat)
      }, HEARTBEAT_MS)
    }

    schedulePoll()
    scheduleBeat()

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        void pollRevision()
      }
      schedulePoll()
    }

    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      if (pollTimer) window.clearTimeout(pollTimer)
      if (beatTimer) window.clearTimeout(beatTimer)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [userId, status, mergeMembers, setRoomSafe, rememberSynced])

  useEffect(() => {
    const flush = flushPendingSaveRef.current
    function onPageHide() {
      flush({ keepalive: true })
    }
    window.addEventListener("pagehide", onPageHide)
    return () => {
      window.removeEventListener("pagehide", onPageHide)
      flush({ keepalive: true })
    }
  }, [code])

  const postUpdate = useCallback(
    async (text: string) => {
      const current = roomRef.current
      if (!current || !user) {
        toast.message("소식을 올리려면 로그인해 주세요.")
        return false
      }
      if (!canPostRoomUpdates(user, current)) {
        toast.message("뷰어는 소식을 올릴 수 없습니다.")
        return false
      }
      const trimmed = text.trim()
      if (!trimmed) {
        toast.error("소식 내용을 입력해 주세요.")
        return false
      }
      const optimistic: Room = {
        ...current,
        updates: [
          ...current.updates,
          {
            id: createId("upd"),
            author: user.name,
            authorId: user.id,
            text: trimmed,
            createdAt: new Date().toISOString(),
          },
        ].slice(-80),
      }
      setRoomSafe(optimistic)
      try {
        const response = await fetch(`/api/rooms/${current.code}`, {
          ...fetchOpts,
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "post-update", text: trimmed }),
        })
        const payload = await parseResponse(response)
        if (response.status === 422) {
          setRoomSafe(current)
          await refreshAuthSession()
          toast.error(payload.error ?? "부적절한 표현이 감지되어 소식을 올리지 않았습니다.")
          return false
        }
        if (!response.ok || !payload.room) {
          setRoomSafe(current)
          throw new Error(payload.error ?? "소식을 올리지 못했습니다.")
        }
        rememberSynced(payload.room)
        setRoomSafe(payload.room)
        return true
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "소식을 올리지 못했습니다.")
        return false
      }
    },
    [user, setRoomSafe, rememberSynced]
  )

  const removeUpdate = useCallback(
    async (updateId: string) => {
      const current = roomRef.current
      if (!current) return false
      const previous = current.updates
      const nextUpdates = previous.filter((item) => item.id !== updateId)
      setRoomSafe({ ...current, updates: nextUpdates })
      try {
        const response = await fetch(`/api/rooms/${current.code}`, {
          ...fetchOpts,
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "remove-update", updateId }),
        })
        const payload = await parseResponse(response)
        if (!response.ok || !payload.room) {
          setRoomSafe(current)
          throw new Error(payload.error ?? "소식을 지우지 못했습니다.")
        }
        rememberSynced(payload.room)
        setRoomSafe(payload.room)
        return true
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "소식을 지우지 못했습니다.")
        return false
      }
    },
    [setRoomSafe, rememberSynced]
  )

  return {
    room,
    status,
    saveState,
    error,
    updateRoom,
    postUpdate,
    removeUpdate,
    canEdit,
    canAccessFeed,
    canPostUpdates,
  }
}
