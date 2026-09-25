import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { dataPath, isReadonlyFsError } from "@/infrastructure/persistence/data-dir"
import { supabaseStorageConfigured } from "@/infrastructure/persistence/supabase-admin"
import {
  readSupabaseBytes,
  writeSupabaseBytes,
} from "@/infrastructure/persistence/supabase-storage"

function blobKey(key: string) {
  return `hsms-md/group-chat/${key}`
}

function filePath(key: string) {
  return dataPath("group-chat", ...key.split("/"))
}

async function putBlob(key: string, bytes: Uint8Array, mime: string): Promise<void> {
  if (supabaseStorageConfigured()) {
    await writeSupabaseBytes(blobKey(key), bytes, mime)
    return
  }
  if (
    !process.env.BLOB_READ_WRITE_TOKEN &&
    !process.env.BLOB_STORE_ID &&
    !process.env.VERCEL &&
    !supabaseStorageConfigured()
  ) {
    return
  }
  if (process.env.VERCEL && !supabaseStorageConfigured()) return
  try {
    const { put } = await import("@vercel/blob")
    await put(blobKey(key), Buffer.from(bytes), {
      access: "public",
      addRandomSuffix: false,
      contentType: mime,
      allowOverwrite: true,
    })
  } catch {
    /* local file is enough */
  }
}

async function getBlob(key: string): Promise<Uint8Array | null> {
  if (supabaseStorageConfigured()) {
    return readSupabaseBytes(blobKey(key))
  }
  if (
    !process.env.BLOB_READ_WRITE_TOKEN &&
    !process.env.BLOB_STORE_ID &&
    !process.env.VERCEL &&
    !supabaseStorageConfigured()
  ) {
    return null
  }
  if (process.env.VERCEL && !supabaseStorageConfigured()) return null
  try {
    const { list } = await import("@vercel/blob")
    const listed = await list({ prefix: blobKey(key), limit: 1 })
    const url = listed.blobs[0]?.url
    if (!url) return null
    const response = await fetch(url)
    if (!response.ok) return null
    return new Uint8Array(await response.arrayBuffer())
  } catch {
    return null
  }
}

export async function saveGroupChatImage(input: {
  code: string
  groupId: string
  messageId: string
  bytes: Uint8Array
  mime: string
}): Promise<void> {
  const key = `${input.code}/${input.groupId}/${input.messageId}`
  await putBlob(key, input.bytes, input.mime)
  try {
    const dest = filePath(key)
    await mkdir(path.dirname(dest), { recursive: true })
    await writeFile(dest, input.bytes)
  } catch (error) {
    if (!isReadonlyFsError(error)) throw error
  }
}

export async function loadGroupChatImage(input: {
  code: string
  groupId: string
  messageId: string
}): Promise<Uint8Array | null> {
  const key = `${input.code}/${input.groupId}/${input.messageId}`
  try {
    return new Uint8Array(await readFile(filePath(key)))
  } catch {
    return getBlob(key)
  }
}
