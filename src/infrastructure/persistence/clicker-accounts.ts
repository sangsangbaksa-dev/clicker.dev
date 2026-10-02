import "server-only"

import type { ClickerAccount, CloudSaveMeta } from "@/domain/services/clicker-account"
import {
  durableStorageRequired,
  readJsonFile,
  readSharedBlobJson,
  sharedBlobEnabled,
  sharedFilePath,
  writeJsonFile,
  writeSharedBlobJson,
} from "@/infrastructure/persistence/shared-json-store"
import { SharedStoreUnavailableError } from "@/infrastructure/persistence/shared-store-error"

/*
 * Game accounts and cloud saves, one JSON object per key in the shared durable store
 * (Supabase Storage on Vercel); a local data/ folder in development.
 */

type StoredSave = { json: string; savedAt: number }

const accountKey = (loginId: string) => `clicker-accounts/${loginId}`
const saveKey = (accountId: string) => `clicker-saves/${accountId}`

/** A serverless host without a durable store would keep accounts in /tmp and lose them. */
function assertDurable(): void {
  if (durableStorageRequired() && !sharedBlobEnabled()) {
    throw new SharedStoreUnavailableError("계정 저장소가 설정되지 않았습니다.")
  }
}

async function readKey<T>(key: string): Promise<T | null> {
  assertDurable()
  if (!sharedBlobEnabled()) return readJsonFile<T>(sharedFilePath(`${key}.json`))
  const read = await readSharedBlobJson<T>(key)
  if (read.status === "hit") return read.value
  if (read.status === "miss") return null
  throw new SharedStoreUnavailableError("계정 저장소를 읽지 못했습니다. 잠시 후 다시 시도해 주세요.")
}

async function writeKey(key: string, value: unknown): Promise<void> {
  assertDurable()
  if (!sharedBlobEnabled()) return writeJsonFile(sharedFilePath(`${key}.json`), value)
  await writeSharedBlobJson(key, value)
}

export function findClickerAccount(loginId: string): Promise<ClickerAccount | null> {
  return readKey<ClickerAccount>(accountKey(loginId))
}

export async function createClickerAccount(account: ClickerAccount): Promise<boolean> {
  if (await findClickerAccount(account.loginId)) return false
  await writeKey(accountKey(account.loginId), account)
  return true
}

export async function readCloudSave(accountId: string): Promise<StoredSave | null> {
  return readKey<StoredSave>(saveKey(accountId))
}

export async function writeCloudSave(accountId: string, json: string, savedAt: number): Promise<CloudSaveMeta> {
  await writeKey(saveKey(accountId), { json, savedAt } satisfies StoredSave)
  return { savedAt, size: json.length }
}
