/**
 * Browser side of game accounts: thin calls to /api/clicker/*. A static build (GitHub Pages)
 * has no API, so every call reports `available: false` there and the UI hides accounts.
 */

import { saveProgress } from "@/domain/services/clicker-account"

/** Total CORE of a stored save (0 when unreadable): how far along a run is. */
export const clickerSaveProgress = saveProgress

/** localStorage key: the account the run on this device belongs to (absent for a guest run). */
const SAVE_OWNER_KEY = "aurelia-clicker-save-owner"

export function readClickerSaveOwner(): string | null {
  try {
    return window.localStorage.getItem(SAVE_OWNER_KEY)
  } catch {
    return null
  }
}

export function writeClickerSaveOwner(accountId: string): void {
  try {
    window.localStorage.setItem(SAVE_OWNER_KEY, accountId)
  } catch {
    /* storage blocked — ownership is only known for this visit */
  }
}

export type ClickerAccountInfo = { id: string; loginId: string; nickname: string }
/** `totalCore`: lifetime CORE across worldlines; `kept`: the upload lost to a more progressed cloud run. */
export type ClickerCloudSave = { json: string; meta: { savedAt: number; size: number; totalCore?: number; kept?: boolean } }

type ApiResult<T> = { ok: true; value: T } | { ok: false; error: string; unavailable?: boolean }

async function call<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      ...init,
      credentials: "same-origin",
      headers: init?.body ? { "content-type": "application/json" } : undefined,
    })
    const type = res.headers.get("content-type") ?? ""
    if (!type.includes("application/json")) return { ok: false, error: "계정 서버에 연결할 수 없습니다.", unavailable: true }
    const body = (await res.json()) as T & { error?: string }
    if (!res.ok) return { ok: false, error: body.error ?? "요청을 처리하지 못했습니다." }
    return { ok: true, value: body }
  } catch {
    return { ok: false, error: "네트워크에 연결할 수 없습니다.", unavailable: true }
  }
}

/** GitHub Pages static export — no clicker API routes; avoid a useless fetch to the site root. */
function clickerStaticHost(): boolean {
  return process.env.NEXT_PUBLIC_CLICKER_STATIC_HOST === "1"
}

/** `available`: there is an account server; `storage`: it can actually keep accounts. */
export async function fetchClickerAccount(): Promise<{ available: boolean; storage: boolean; account: ClickerAccountInfo | null }> {
  if (clickerStaticHost()) return { available: false, storage: false, account: null }
  const r = await call<{ account: ClickerAccountInfo | null; storage?: boolean }>("/api/clicker/auth/me")
  if (!r.ok) return { available: !r.unavailable, storage: false, account: null }
  return { available: true, storage: r.value.storage !== false, account: r.value.account }
}

export function signupClickerAccount(input: { loginId: string; nickname: string; password: string; passwordConfirm: string }) {
  return call<{ account: ClickerAccountInfo }>("/api/clicker/auth/signup", { method: "POST", body: JSON.stringify(input) })
}

export function loginClickerAccount(loginId: string, password: string) {
  return call<{ account: ClickerAccountInfo }>("/api/clicker/auth/login", { method: "POST", body: JSON.stringify({ loginId, password }) })
}

export function logoutClickerAccount() {
  return call<{ ok: true }>("/api/clicker/auth/logout", { method: "POST" })
}

export function fetchCloudSave() {
  return call<{ save: ClickerCloudSave | null }>("/api/clicker/save")
}

/** `keepalive` lets the upload finish while the page is closing. */
export function uploadCloudSave(json: string, keepalive = false) {
  return call<{ meta: ClickerCloudSave["meta"] }>("/api/clicker/save", { method: "PUT", body: JSON.stringify({ json }), keepalive })
}
