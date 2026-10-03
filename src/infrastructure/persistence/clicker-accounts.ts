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
import { supabaseProjectUrl, supabaseServiceRoleKey } from "@/infrastructure/persistence/supabase-admin"

/*
 * Game accounts and cloud saves, one JSON object per key in the shared durable store
 * (Supabase Storage on Vercel); a local data/ folder in development.
 */

type StoredSave = { json: string; savedAt: number }

const accountKey = (loginId: string) => `clicker-accounts/${loginId}`
const saveKey = (accountId: string) => `clicker-saves/${accountId}`

/** False on a serverless host with no durable store: accounts would land in /tmp and vanish. */
export function clickerAccountStorageReady(): boolean {
  return !(durableStorageRequired() && !sharedBlobEnabled())
}

/**
 * Names (never values) of the store settings the server cannot see, so a host whose env
 * vars did not land can be diagnosed from the outside. Empty when storage is ready.
 */
export function clickerAccountStorageMissing(): string[] {
  if (clickerAccountStorageReady()) return []
  return [
    supabaseProjectUrl() ? null : "SUPABASE_URL",
    supabaseServiceRoleKey() ? null : "SUPABASE_SERVICE_ROLE_KEY",
  ].filter((name): name is string => name !== null)
}

function assertDurable(): void {
  if (!clickerAccountStorageReady()) {
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

export async function writeCloudSave(accountId: string, json: string, savedAt: number): Promise<Omit<CloudSaveMeta, "totalCore">> {
  await writeKey(saveKey(accountId), { json, savedAt } satisfies StoredSave)
  return { savedAt, size: json.length }
}
