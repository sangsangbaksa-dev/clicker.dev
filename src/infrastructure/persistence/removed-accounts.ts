import {
  mergeRemovedAccounts,
  type RemovedAccountRecord,
} from "@/infrastructure/persistence/shared-merge"
import {
  readJsonFile,
  readSharedLayers,
  rememberSnapshot,
  sharedFilePath,
  writeJsonFile,
  writeSharedJson,
} from "@/infrastructure/persistence/shared-json-store"

const FILE_NAME = sharedFilePath("users", "removed-accounts.json")
const BLOB_KEY = "removed-accounts"
const NETLIFY_STORE = "sohaengbang-users"

export type RemovedAccountReason = "expelled" | "rejected"
export type { RemovedAccountRecord }

type RemovedAccountIndex = Record<string, RemovedAccountRecord>

function normalizeLoginId(loginId: string): string {
  return loginId.trim().toLowerCase()
}

function shouldUseNetlifyBlobs(): boolean {
  return (
    process.env.NETLIFY === "true" ||
    Boolean(process.env.NETLIFY_BLOBS_CONTEXT) ||
    Boolean(process.env.BLOBS_CONTEXT)
  )
}

async function netlifyStore() {
  const { getStore } = await import("@netlify/blobs")
  return getStore(NETLIFY_STORE)
}

async function readFromNetlify(): Promise<RemovedAccountIndex | null> {
  if (!shouldUseNetlifyBlobs()) return null
  try {
    const store = await netlifyStore()
    const value = await store.get(BLOB_KEY, { type: "json" })
    return (value as RemovedAccountIndex | null) ?? null
  } catch {
    return null
  }
}

async function readIndex(): Promise<RemovedAccountIndex> {
  const layers = await readSharedLayers<RemovedAccountIndex>(BLOB_KEY, () =>
    readJsonFile<RemovedAccountIndex>(FILE_NAME)
  )
  const netlify = await readFromNetlify()
  const index = mergeRemovedAccounts([
    layers.file,
    layers.blob,
    layers.cache,
    layers.snapshot,
    netlify,
  ])
  rememberSnapshot(BLOB_KEY, index)
  return index
}

async function writeIndex(index: RemovedAccountIndex): Promise<void> {
  const current = await readIndex()
  const merged = mergeRemovedAccounts([current, index])
  rememberSnapshot(BLOB_KEY, merged)
  await writeSharedJson(BLOB_KEY, merged, () => writeJsonFile(FILE_NAME, merged))
  if (shouldUseNetlifyBlobs()) {
    try {
      const store = await netlifyStore()
      await store.setJSON(BLOB_KEY, merged)
    } catch {
      // optional
    }
  }
}

export function removedAccountLoginMessage(reason: RemovedAccountReason): string {
  if (reason === "expelled") {
    return "퇴출당한 계정입니다."
  }
  return "가입이 거절된 계정입니다."
}

export async function findRemovedAccount(
  loginId: string
): Promise<RemovedAccountRecord | null> {
  const normalized = normalizeLoginId(loginId)
  if (!normalized) return null
  const index = await readIndex()
  return index[normalized] ?? null
}

export async function recordRemovedAccount(input: {
  loginId: string
  passwordHash: string
  reason: RemovedAccountReason
}): Promise<void> {
  const normalized = normalizeLoginId(input.loginId)
  if (!normalized) return
  const index = await readIndex()
  index[normalized] = {
    loginId: input.loginId.trim(),
    passwordHash: input.passwordHash,
    reason: input.reason,
    removedAt: new Date().toISOString(),
  }
  await writeIndex(index)
}

export async function isExpelledLoginId(loginId: string): Promise<boolean> {
  const record = await findRemovedAccount(loginId)
  return record?.reason === "expelled"
}

export async function listRemovedLoginIds(
  reason?: RemovedAccountReason
): Promise<Set<string>> {
  const index = await readIndex()
  const ids = new Set<string>()
  for (const [loginId, record] of Object.entries(index)) {
    if (reason && record.reason !== reason) continue
    ids.add(loginId)
  }
  return ids
}
