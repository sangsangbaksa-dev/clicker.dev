import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { dataPath, isReadonlyFsError } from "@/infrastructure/persistence/data-dir"
import {
  runtimeGetWithStatus,
  runtimeSet,
} from "@/infrastructure/persistence/runtime-json-store"
import { layersAreConfirmedEmpty } from "@/infrastructure/persistence/shared-merge"
import { SharedStoreUnavailableError } from "@/infrastructure/persistence/shared-store-error"
import { supabaseStorageConfigured } from "@/infrastructure/persistence/supabase-admin"
import {
  deleteSupabaseJson,
  listSupabaseObjects,
  readSupabaseJson,
  readSupabasePathname,
  writeSupabaseJson,
} from "@/infrastructure/persistence/supabase-storage"
import type {
  LayerRead,
  LayerStatus,
  SharedBlobInfo,
} from "@/infrastructure/persistence/shared-store-types"

export type { LayerRead, LayerStatus, SharedBlobInfo } from "@/infrastructure/persistence/shared-store-types"

const snapshots = new Map<string, unknown>()
let blobUnavailable = false

export type SharedLayers<T> = {
  blob: T | null
  cache: T | null
  file: T | null
  snapshot: T | null
  blobStatus: LayerStatus
  cacheStatus: LayerStatus
  /** True when a durable store confirmed the key is absent. */
  confirmedEmpty: boolean
  /** True when a shared get failed or timed out — do not save defaults. */
  unreliable: boolean
}

const BLOB_READ_TIMEOUT_MS = 8_000
const BLOB_WRITE_TIMEOUT_MS = 10_000
const BLOB_LIST_TIMEOUT_MS = 12_000

function blobPath(key: string): string {
  return `hsms-md/${key}.json`
}

function vercelBlobShouldTry(): boolean {
  if (blobUnavailable || supabaseStorageConfigured()) return false
  // Vercel 배포는 Supabase Storage만 사용 — Vercel Blob으로 fallback하지 않음.
  if (process.env.VERCEL) return false
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID)
}

function netlifyBlobsConfigured(): boolean {
  if (supabaseStorageConfigured()) return false
  return (
    process.env.NETLIFY === "true" ||
    Boolean(process.env.NETLIFY_BLOBS_CONTEXT) ||
    Boolean(process.env.BLOBS_CONTEXT)
  )
}

/** Serverless hosts need a durable store (Supabase Storage on Vercel/Netlify). */
export function durableStorageRequired(): boolean {
  if (supabaseStorageConfigured()) return true
  if (netlifyBlobsConfigured()) return false
  if (process.env.VERCEL) return true
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

/** @deprecated Use durableStorageRequired */
export function vercelBlobRequired(): boolean {
  return durableStorageRequired() && !supabaseStorageConfigured()
}

export function sharedBlobEnabled(): boolean {
  return supabaseStorageConfigured() || vercelBlobShouldTry()
}

function blobErrorStatus(error: unknown): LayerStatus {
  const name = error instanceof Error ? error.name : ""
  const message = error instanceof Error ? error.message : String(error)
  const text = `${name} ${message}`
  if (/BlobNotFound|404|not found/i.test(text)) return "miss"
  if (
    /BlobStoreNotFound|BlobAccess|No token|token is missing|BLOB_|store id|not configured/i.test(
      text
    )
  ) {
    return "skip"
  }
  if (/limit|quota|suspended|threshold|usage|exceeded|forbidden|403|503/i.test(text)) {
    return "miss"
  }
  return "error"
}

async function readVercelBlob<T>(key: string): Promise<LayerRead<T>> {
  if (!vercelBlobShouldTry()) return { status: "skip", value: null }
  try {
    const { get } = await import("@vercel/blob")
    const result = await get(blobPath(key), {
      access: "private",
      useCache: false,
      abortSignal: AbortSignal.timeout(BLOB_READ_TIMEOUT_MS),
    })
    if (!result || result.statusCode !== 200 || !result.stream) {
      return { status: "miss", value: null }
    }
    const text = await new Response(result.stream).text()
    if (!text) return { status: "miss", value: null }
    return { status: "hit", value: JSON.parse(text) as T }
  } catch (error) {
    const status = blobErrorStatus(error)
    if (status === "skip") blobUnavailable = true
    return { status, value: null }
  }
}

async function readDurableBlob<T>(key: string): Promise<LayerRead<T>> {
  if (supabaseStorageConfigured()) return readSupabaseJson<T>(key)
  return readVercelBlob<T>(key)
}

async function writeDurableBlob(key: string, value: unknown): Promise<LayerStatus> {
  if (supabaseStorageConfigured()) return writeSupabaseJson(key, value)
  if (!vercelBlobShouldTry()) return "skip"
  try {
    const { put } = await import("@vercel/blob")
    await put(blobPath(key), JSON.stringify(value), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 60,
      abortSignal: AbortSignal.timeout(BLOB_WRITE_TIMEOUT_MS),
    })
    return "hit"
  } catch (error) {
    const status = blobErrorStatus(error)
    if (status === "skip") blobUnavailable = true
    return status
  }
}

export async function listSharedBlobs(prefix = "hsms-md/"): Promise<SharedBlobInfo[]> {
  if (supabaseStorageConfigured()) return listSupabaseObjects(prefix)
  if (!vercelBlobShouldTry()) return []
  try {
    const { list } = await import("@vercel/blob")
    const out: SharedBlobInfo[] = []
    let cursor: string | undefined
    do {
      const page = await list({
        prefix,
        limit: 1000,
        cursor,
        abortSignal: AbortSignal.timeout(BLOB_LIST_TIMEOUT_MS),
      })
      for (const blob of page.blobs) {
        out.push({
          pathname: blob.pathname,
          url: blob.url,
          uploadedAt: blob.uploadedAt.toISOString(),
          size: blob.size,
        })
      }
      cursor = page.hasMore ? page.cursor : undefined
    } while (cursor)
    return out
  } catch (error) {
    if (blobErrorStatus(error) === "skip") blobUnavailable = true
    return []
  }
}

export async function readBlobPathname<T>(pathname: string): Promise<T | null> {
  if (supabaseStorageConfigured()) return readSupabasePathname<T>(pathname)
  if (!vercelBlobShouldTry()) return null
  try {
    const { get } = await import("@vercel/blob")
    const result = await get(pathname, {
      access: "private",
      useCache: false,
      abortSignal: AbortSignal.timeout(BLOB_READ_TIMEOUT_MS),
    })
    if (!result || result.statusCode !== 200 || !result.stream) return null
    const text = await new Response(result.stream).text()
    if (!text) return null
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

export async function writeBlobBackup(key: string, value: unknown): Promise<void> {
  if (process.env.VERCEL || supabaseStorageConfigured()) return
  if (!vercelBlobShouldTry()) return
  try {
    await writeDurableBlob(key, value)
  } catch {
    // backups must not block the live save
  }
}

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf8")
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  try {
    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(filePath, JSON.stringify(value, null, 2), "utf8")
  } catch (error) {
    if (!isReadonlyFsError(error)) throw error
  }
}

export function rememberSnapshot<T>(key: string, value: T): void {
  snapshots.set(key, value)
}

export function peekSnapshot<T>(key: string): T | null {
  return (snapshots.get(key) as T | undefined) ?? null
}

export async function readSharedLayers<T>(
  key: string,
  readFileLayer: () => Promise<T | null>
): Promise<SharedLayers<T>> {
  const [blob, cache, file] = await Promise.all([
    readDurableBlob<T>(key),
    runtimeGetWithStatus<T>(key),
    readFileLayer(),
  ])
  const snapshot = peekSnapshot<T>(key)

  const unreliable = blob.status === "error" || cache.status === "error"
  const confirmedEmpty = layersAreConfirmedEmpty({
    unreliable,
    blobStatus: blob.status,
    cacheStatus: cache.status,
    file,
    snapshot,
  })

  return {
    blob: blob.value,
    cache: cache.value,
    file,
    snapshot,
    blobStatus: blob.status,
    cacheStatus: cache.status,
    confirmedEmpty,
    unreliable,
  }
}

function durableWriteError(status: LayerStatus, action: "save" | "delete"): Error {
  if (process.env.VERCEL && !supabaseStorageConfigured()) {
    return new SharedStoreUnavailableError(
      "Vercel 배포에는 Supabase Storage가 필요합니다. SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 Vercel 환경 변수에 설정해 주세요."
    )
  }
  if (supabaseStorageConfigured()) {
    if (status === "skip") {
      return new SharedStoreUnavailableError(
        "Supabase Storage가 연결되지 않았습니다. SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 설정해 주세요."
      )
    }
    return new SharedStoreUnavailableError(
      action === "delete"
        ? "Supabase Storage에서 지우지 못했습니다. 잠시 후 다시 시도해 주세요."
        : "Supabase Storage에 쓰지 못했습니다. 잠시 후 다시 시도해 주세요."
    )
  }
  if (status === "skip") {
    return new SharedStoreUnavailableError(
      "공유 저장소가 연결되지 않았습니다. Supabase 또는 Blob 설정을 확인해 주세요."
    )
  }
  return new SharedStoreUnavailableError(
    action === "delete"
      ? "공유 저장소에서 지우지 못했습니다. 잠시 후 다시 시도해 주세요."
      : "공유 저장소에 쓰지 못했습니다. 잠시 후 다시 시도해 주세요."
  )
}

export async function writeSharedJson(
  key: string,
  value: unknown,
  writeFileLayer?: () => Promise<void>
): Promise<void> {
  rememberSnapshot(key, value)
  const [blobStatus] = await Promise.all([
    writeDurableBlob(key, value),
    runtimeSet(key, value),
    writeFileLayer?.() ?? Promise.resolve(),
  ])
  if (durableStorageRequired() && blobStatus !== "hit") {
    throw durableWriteError(blobStatus, "save")
  }
}

export function sharedFilePath(...segments: string[]): string {
  return dataPath(...segments)
}

export async function readSharedBlobJson<T>(key: string): Promise<LayerRead<T>> {
  return readDurableBlob<T>(key)
}

export async function writeSharedBlobJson(key: string, value: unknown): Promise<LayerStatus> {
  const status = await writeDurableBlob(key, value)
  if (durableStorageRequired() && status !== "hit") {
    throw durableWriteError(status, "save")
  }
  return status
}

export async function deleteSharedBlob(key: string): Promise<void> {
  if (supabaseStorageConfigured()) {
    const status = await deleteSupabaseJson(key)
    if (durableStorageRequired() && status !== "hit" && status !== "miss") {
      throw durableWriteError(status, "delete")
    }
    return
  }
  if (!vercelBlobShouldTry()) {
    if (durableStorageRequired()) {
      throw durableWriteError("skip", "delete")
    }
    return
  }
  try {
    const { del } = await import("@vercel/blob")
    await del(blobPath(key), {
      abortSignal: AbortSignal.timeout(BLOB_WRITE_TIMEOUT_MS),
    })
  } catch (error) {
    const status = blobErrorStatus(error)
    if (status === "miss") return
    if (status === "skip") blobUnavailable = true
    if (durableStorageRequired()) {
      throw durableWriteError(status, "delete")
    }
  }
}
