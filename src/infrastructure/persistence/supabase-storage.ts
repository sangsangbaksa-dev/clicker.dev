import type {
  LayerRead,
  LayerStatus,
  SharedBlobInfo,
} from "@/infrastructure/persistence/shared-store-types"
import {
  getSupabaseAdmin,
  HSMS_STORAGE_BUCKET,
  supabaseStorageConfigured,
} from "@/infrastructure/persistence/supabase-admin"

const READ_TIMEOUT_MS = 8_000
const WRITE_TIMEOUT_MS = 10_000

function storagePath(key: string): string {
  const normalized = key.startsWith("hsms-md/") ? key : `hsms-md/${key}`
  return normalized.endsWith(".json") ? normalized : `${normalized}.json`
}

function supabaseErrorStatus(error: unknown): LayerStatus {
  const message = error instanceof Error ? error.message : String(error)
  if (/not found|404|No such object|Object not found/i.test(message)) return "miss"
  if (/not configured|missing|required/i.test(message)) return "skip"
  return "error"
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Supabase Storage request timed out")), ms)
      }),
    ])
  } finally {
    // 요청이 먼저 끝나면 타이머를 지워, 요청마다 남는 타이머가 쌓이지 않게 한다.
    clearTimeout(timer)
  }
}

export function supabaseDurableStorageActive(): boolean {
  return supabaseStorageConfigured()
}

export async function readSupabaseJson<T>(key: string): Promise<LayerRead<T>> {
  if (!supabaseStorageConfigured()) return { status: "skip", value: null }
  try {
    const supabase = getSupabaseAdmin()
    const path = storagePath(key)
    const { data, error } = await withTimeout(
      supabase.storage.from(HSMS_STORAGE_BUCKET).download(path),
      READ_TIMEOUT_MS
    )
    if (error) {
      return { status: supabaseErrorStatus(error), value: null }
    }
    if (!data) return { status: "miss", value: null }
    const text = await data.text()
    if (!text) return { status: "miss", value: null }
    return { status: "hit", value: JSON.parse(text) as T }
  } catch (error) {
    return { status: supabaseErrorStatus(error), value: null }
  }
}

export async function writeSupabaseJson(key: string, value: unknown): Promise<LayerStatus> {
  if (!supabaseStorageConfigured()) return "skip"
  try {
    const supabase = getSupabaseAdmin()
    const path = storagePath(key)
    const body = JSON.stringify(value)
    const { error } = await withTimeout(
      supabase.storage.from(HSMS_STORAGE_BUCKET).upload(path, body, {
        upsert: true,
        contentType: "application/json",
        cacheControl: "60",
      }),
      WRITE_TIMEOUT_MS
    )
    if (error) return supabaseErrorStatus(error)
    return "hit"
  } catch (error) {
    return supabaseErrorStatus(error)
  }
}

export async function deleteSupabaseJson(key: string): Promise<LayerStatus> {
  if (!supabaseStorageConfigured()) return "skip"
  try {
    const supabase = getSupabaseAdmin()
    const path = storagePath(key)
    const { error } = await withTimeout(
      supabase.storage.from(HSMS_STORAGE_BUCKET).remove([path]),
      WRITE_TIMEOUT_MS
    )
    if (error) return supabaseErrorStatus(error)
    return "hit"
  } catch (error) {
    return supabaseErrorStatus(error)
  }
}

async function listFolder(prefix: string, out: SharedBlobInfo[]): Promise<void> {
  const supabase = getSupabaseAdmin()
  const folder = prefix.replace(/\/$/, "")
  const { data, error } = await supabase.storage.from(HSMS_STORAGE_BUCKET).list(folder, {
    limit: 1000,
    sortBy: { column: "updated_at", order: "desc" },
  })
  if (error || !data) return
  for (const item of data) {
    const pathname = folder ? `${folder}/${item.name}` : item.name
    if (item.id) {
      out.push({
        pathname,
        url: "",
        uploadedAt: item.updated_at ?? item.created_at ?? new Date().toISOString(),
        size: item.metadata?.size ?? 0,
      })
      continue
    }
    await listFolder(pathname, out)
  }
}

export async function listSupabaseObjects(prefix = "hsms-md/"): Promise<SharedBlobInfo[]> {
  if (!supabaseStorageConfigured()) return []
  try {
    const out: SharedBlobInfo[] = []
    await listFolder(prefix, out)
    return out
  } catch {
    return []
  }
}

export async function readSupabasePathname<T>(pathname: string): Promise<T | null> {
  if (!supabaseStorageConfigured()) return null
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await withTimeout(
      supabase.storage.from(HSMS_STORAGE_BUCKET).download(pathname),
      READ_TIMEOUT_MS
    )
    if (error || !data) return null
    const text = await data.text()
    if (!text) return null
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

export async function writeSupabaseBytes(
  pathname: string,
  bytes: Uint8Array,
  mime: string
): Promise<boolean> {
  if (!supabaseStorageConfigured()) return false
  try {
    const supabase = getSupabaseAdmin()
    const { error } = await withTimeout(
      supabase.storage.from(HSMS_STORAGE_BUCKET).upload(pathname, bytes, {
        upsert: true,
        contentType: mime,
      }),
      WRITE_TIMEOUT_MS
    )
    return !error
  } catch {
    return false
  }
}

export async function readSupabaseBytes(pathname: string): Promise<Uint8Array | null> {
  if (!supabaseStorageConfigured()) return null
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await withTimeout(
      supabase.storage.from(HSMS_STORAGE_BUCKET).download(pathname),
      READ_TIMEOUT_MS
    )
    if (error || !data) return null
    return new Uint8Array(await data.arrayBuffer())
  } catch {
    return null
  }
}
