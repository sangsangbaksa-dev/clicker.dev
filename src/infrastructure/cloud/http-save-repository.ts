import type {
  CloudLoadResult,
  CloudSaveResult,
  SaveRepository,
} from "../../application/clicker-backup-ports.ts"
import { safeSignInUrl, type CloudSaveAvailability } from "../../domain/services/clicker-cloud-save.ts"

/**
 * HTTP adapter for the server contract in the patch README (`/api/clicker/cloud-save`).
 * Authentication is the server's: a same-origin HttpOnly session cookie that this code never
 * reads, stores or logs. On a static host (GitHub Pages) the path 404s / returns HTML, which
 * is reported as "unavailable" and the UI shows a notice instead of buttons.
 */
export const CLOUD_SAVE_PATH = "/api/clicker/cloud-save"

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

type Options = {
  fetch?: FetchLike
  /** Prefix for hosts served under a sub path. Default "". */
  basePath?: string
  timeoutMs?: number
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v)
}

async function readJson(res: Response): Promise<unknown | null> {
  const type = res.headers.get("content-type") ?? ""
  if (!type.includes("application/json")) return null
  try {
    return await res.json()
  } catch {
    return null
  }
}

export function createHttpSaveRepository(options: Options = {}): SaveRepository {
  const base = (options.basePath ?? "") + CLOUD_SAVE_PATH
  const timeoutMs = options.timeoutMs ?? 8000

  async function call(path: string, init?: RequestInit): Promise<{ res: Response; body: unknown | null } | null> {
    const doFetch: FetchLike = options.fetch ?? ((i, o) => fetch(i, o))
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null
    const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null
    try {
      const res = await doFetch(base + path, {
        credentials: "same-origin",
        cache: "no-store",
        ...init,
        signal: ctl?.signal,
      })
      return { res, body: await readJson(res) }
    } catch {
      return null
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  return {
    async availability(): Promise<CloudSaveAvailability> {
      const r = await call("/status")
      if (!r || !r.res.ok || !isRecord(r.body) || typeof r.body.signedIn !== "boolean") {
        return { state: "unavailable" }
      }
      if (r.body.signedIn) {
        return { state: "signed-in", email: typeof r.body.email === "string" ? r.body.email : null }
      }
      const signInUrl = safeSignInUrl(r.body.signInUrl)
      return signInUrl ? { state: "signed-out", signInUrl } : { state: "unavailable" }
    },

    async load(): Promise<CloudLoadResult> {
      const r = await call("")
      if (!r) return { status: "unavailable" }
      if (r.res.status === 401) return { status: "signed-out" }
      if (r.res.status === 204) return { status: "empty" }
      // A JSON 404 from our route means "no save yet"; an HTML 404 means there is no route at all.
      if (r.res.status === 404) return isRecord(r.body) && r.body.empty === true ? { status: "empty" } : { status: "unavailable" }
      if (!r.res.ok || !isRecord(r.body)) return { status: "error", message: "서버 응답을 읽을 수 없습니다." }
      if (r.body.empty === true) return { status: "empty" }
      const { code, savedAt, updatedAt } = r.body
      if (typeof code !== "string" || typeof savedAt !== "number" || typeof updatedAt !== "number") {
        return { status: "error", message: "서버 응답을 읽을 수 없습니다." }
      }
      return { status: "found", record: { code, savedAt, updatedAt } }
    },

    async save(record): Promise<CloudSaveResult> {
      const r = await call("", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: record.code, savedAt: record.savedAt }),
      })
      if (!r) return { status: "unavailable" }
      if (r.res.status === 401) return { status: "signed-out" }
      if (r.res.status === 404 && r.body === null) return { status: "unavailable" }
      if (!r.res.ok) {
        const message = isRecord(r.body) && typeof r.body.error === "string" ? r.body.error : "서버에 저장하지 못했습니다."
        return { status: "error", message }
      }
      const updatedAt = isRecord(r.body) && typeof r.body.updatedAt === "number" ? r.body.updatedAt : Date.now()
      return { status: "saved", updatedAt }
    },
  }
}
