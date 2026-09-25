"use client"

import { useAuthInitialUser } from "@/components/auth/auth-initial-context"
import { resolveAccessLevel } from "@/domain/services/access-level"
import type { AuthUser } from "@/domain/entities/board"
import { useCallback, useMemo, useSyncExternalStore } from "react"

type AuthSnapshot = {
  user: AuthUser | null
  ready: boolean
}

export type RemovalNoticeReason = "remove" | "reject"

export type RemovalNoticeState = {
  name: string
  reason: RemovalNoticeReason
}

const listeners = new Set<() => void>()
const removalListeners = new Set<() => void>()
let snapshot: AuthSnapshot = { user: null, ready: false }
let removalNotice: RemovalNoticeState | null = null
let loadStarted = false
/** Bumped on login/signup/logout so late /api/auth/me responses cannot clobber. */
let sessionGeneration = 0
let deferredRefreshAttached = false
let sessionInflight: Promise<AuthUser | null> | null = null
let lastSessionLoadAt = 0
const SESSION_COOLDOWN_MS = 2_500

function normalizeUser(user: AuthUser): AuthUser {
  return {
    ...user,
    accessLevel: resolveAccessLevel(user),
  }
}

function emit() {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function subscribeRemoval(listener: () => void) {
  removalListeners.add(listener)
  return () => {
    removalListeners.delete(listener)
  }
}

function emitRemoval() {
  removalListeners.forEach((listener) => listener())
}

export function triggerRemovalNotice(state: RemovalNoticeState) {
  if (removalNotice) return
  removalNotice = state
  sessionGeneration += 1
  emitRemoval()
}

export function clearRemovalNotice() {
  if (!removalNotice) return
  removalNotice = null
  emitRemoval()
}

export function useRemovalNotice() {
  return useSyncExternalStore(
    subscribeRemoval,
    () => removalNotice,
    () => null
  )
}

function getSnapshot() {
  return snapshot
}

function buildServerSnapshot(initialUser: AuthUser | null): AuthSnapshot {
  return {
    user: initialUser ? normalizeUser(initialUser) : null,
    ready: true,
  }
}

function authUserSnapshotKey(user: AuthUser | null): string {
  if (!user) return "guest"
  return `${user.id}|${user.status}|${user.accessLevel ?? ""}|${user.classN ?? ""}|${user.englishLevel ?? ""}|${user.mathLevel ?? ""}|${user.loginId}|${user.contentHold?.createdAt ?? ""}`
}

function setSnapshot(next: AuthSnapshot) {
  const unchanged =
    snapshot.ready === next.ready &&
    authUserSnapshotKey(snapshot.user) === authUserSnapshotKey(next.user)
  if (unchanged) return
  snapshot = next
  emit()
}

function applySessionMutation(user: AuthUser | null) {
  sessionGeneration += 1
  setSnapshot({ user, ready: true })
  attachDeferredRefresh()
}

function attachDeferredRefresh() {
  if (deferredRefreshAttached || typeof window === "undefined") return
  deferredRefreshAttached = true
  window.addEventListener("focus", () => void loadSession())
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void loadSession()
  })
}

async function loadSession() {
  if (sessionInflight) return sessionInflight
  if (snapshot.ready && Date.now() - lastSessionLoadAt < SESSION_COOLDOWN_MS) {
    return snapshot.user
  }

  const generation = sessionGeneration
  sessionInflight = (async () => {
    try {
      const response = await fetch("/api/auth/me", {
        cache: "no-store",
        credentials: "same-origin",
      })
      if (generation !== sessionGeneration) return snapshot.user
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          const payload = (await response.json().catch(() => ({}))) as {
            removed?: boolean
          }
          if (payload.removed && snapshot.user) {
            triggerRemovalNotice({
              name: snapshot.user.name,
              reason:
                snapshot.user.status === "pending" ? "reject" : "remove",
            })
          }
          setSnapshot({ user: null, ready: true })
        } else if (!snapshot.user) {
          setSnapshot({ user: null, ready: true })
        }
        return snapshot.user
      }
      const payload = (await response.json()) as { user?: AuthUser | null }
      if (generation !== sessionGeneration) return snapshot.user
      const user = payload.user ? normalizeUser(payload.user) : null
      setSnapshot({ user, ready: true })
      attachDeferredRefresh()
      return user
    } catch {
      if (generation !== sessionGeneration) return snapshot.user
      if (!snapshot.user) {
        setSnapshot({ user: null, ready: true })
      }
      return snapshot.user
    } finally {
      lastSessionLoadAt = Date.now()
      sessionInflight = null
    }
  })()
  return sessionInflight
}

/** Seed session from server-rendered user; skip duplicate /me when SSR already has user. */
export function hydrateAuth(initialUser: AuthUser | null) {
  if (typeof window === "undefined") return
  loadStarted = true
  setSnapshot({
    user: initialUser ? normalizeUser(initialUser) : null,
    ready: true,
  })
  attachDeferredRefresh()
  if (!initialUser) {
    void loadSession()
  }
}

function ensureLoaded() {
  if (loadStarted || typeof window === "undefined") return
  loadStarted = true
  setSnapshot({ user: null, ready: true })
  void loadSession()
}

export function useAuth() {
  const initialUser = useAuthInitialUser()
  ensureLoaded()
  const serverSnapshot = useMemo(() => buildServerSnapshot(initialUser), [initialUser])
  const state = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => serverSnapshot
  )

  const refresh = useCallback(async () => loadSession(), [])

  const login = useCallback(async (loginId: string, password: string) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ loginId, password }),
    })
    const payload = (await response.json()) as { user?: AuthUser; error?: string }
    if (!response.ok || !payload.user) {
      throw new Error(payload.error ?? "로그인에 실패했습니다.")
    }
    const user = normalizeUser(payload.user)
    applySessionMutation(user)
    return user
  }, [])

  const signup = useCallback(
    async (
      loginId: string,
      name: string,
      password: string,
      passwordConfirm?: string,
      classN?: number,
      englishLevel?: import("@/domain/entities/user").SchoolLevel,
      mathLevel?: import("@/domain/entities/user").SchoolLevel
    ) => {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          loginId,
          name,
          password,
          passwordConfirm,
          classN,
          englishLevel,
          mathLevel,
        }),
      })
      const payload = (await response.json()) as { user?: AuthUser; error?: string }
      if (!response.ok || !payload.user) {
        throw new Error(payload.error ?? "회원가입에 실패했습니다.")
      }
      const user = normalizeUser(payload.user)
      applySessionMutation(user)
      return user
    },
    []
  )

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" })
    applySessionMutation(null)
  }, [])

  return {
    user: state.user,
    ready: state.ready,
    login,
    signup,
    logout,
    refresh,
  }
}

/** Refresh session outside React (e.g. after room save 403). */
export async function refreshAuthSession() {
  return loadSession()
}
