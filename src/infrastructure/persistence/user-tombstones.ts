import { mergeTombstoneIds } from "@/domain/services/member-roster"
import { dataPath } from "@/infrastructure/persistence/data-dir"
import {
  readJsonFile,
  readSharedLayers,
  rememberSnapshot,
  writeJsonFile,
  writeSharedJson,
} from "@/infrastructure/persistence/shared-json-store"
import { WALDO_OWNER_SEED } from "@/infrastructure/persistence/waldo-owner-seed"

const BLOB_KEY = "user-tombstones"
const FILE_PATH = dataPath("users", "tombstones.json")
const NETLIFY_STORE = "sohaengbang-users"

export type UserTombstoneDocument = {
  ids: string[]
  updatedAt: string
}

function shouldUseNetlifyBlobs(): boolean {
  return (
    process.env.NETLIFY === "true" ||
    Boolean(process.env.NETLIFY_BLOBS_CONTEXT) ||
    Boolean(process.env.BLOBS_CONTEXT)
  )
}

function withoutOwner(ids: Iterable<string>): string[] {
  return mergeTombstoneIds([ids]).filter((id) => id !== WALDO_OWNER_SEED.id)
}

function asDocument(value: unknown): UserTombstoneDocument | null {
  if (!value || typeof value !== "object") return null
  const row = value as { ids?: unknown; updatedAt?: unknown }
  if (!Array.isArray(row.ids)) return null
  return {
    ids: withoutOwner(row.ids.filter((id): id is string => typeof id === "string")),
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : "",
  }
}

async function netlifyStore() {
  const { getStore } = await import("@netlify/blobs")
  return getStore(NETLIFY_STORE)
}

async function readFromNetlify(): Promise<UserTombstoneDocument | null> {
  if (!shouldUseNetlifyBlobs()) return null
  try {
    const store = await netlifyStore()
    return asDocument(await store.get(BLOB_KEY, { type: "json" }))
  } catch {
    return null
  }
}

export async function loadUserTombstones(): Promise<string[]> {
  const layers = await readSharedLayers<UserTombstoneDocument>(BLOB_KEY, () =>
    readJsonFile<UserTombstoneDocument>(FILE_PATH)
  )
  const netlify = await readFromNetlify()
  const ids = withoutOwner(
    mergeTombstoneIds([
      asDocument(layers.file)?.ids,
      asDocument(layers.blob)?.ids,
      asDocument(layers.cache)?.ids,
      asDocument(layers.snapshot)?.ids,
      netlify?.ids,
    ])
  )
  rememberSnapshot(BLOB_KEY, { ids, updatedAt: "" } satisfies UserTombstoneDocument)
  return ids
}

export async function addUserTombstones(ids: Iterable<string>): Promise<string[]> {
  const extra = withoutOwner(ids)
  const current = await loadUserTombstones()
  if (extra.length === 0) return current
  const nextIds = withoutOwner(mergeTombstoneIds([current, extra]))
  if (nextIds.length === current.length && nextIds.every((id, index) => id === current[index])) {
    return current
  }
  const doc: UserTombstoneDocument = {
    ids: nextIds,
    updatedAt: new Date().toISOString(),
  }
  rememberSnapshot(BLOB_KEY, doc)
  await writeSharedJson(BLOB_KEY, doc, () => writeJsonFile(FILE_PATH, doc))
  if (shouldUseNetlifyBlobs()) {
    try {
      const store = await netlifyStore()
      await store.setJSON(BLOB_KEY, doc)
    } catch {
      // Netlify blobs are optional outside Netlify.
    }
  }
  return nextIds
}
