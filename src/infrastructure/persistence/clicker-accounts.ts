import { nicknameKey } from "@/domain/services/clicker-account"
import {
  readJsonFile,
  readSharedLayers,
  sharedFilePath,
  writeJsonFile,
  writeSharedJson,
} from "@/infrastructure/persistence/shared-json-store"

/**
 * One record per nickname and one per save, so accounts never race each other on a
 * shared directory file. Same durable layers as the rest of the site (Supabase / Blobs /
 * runtime cache / local data dir).
 */
export type ClickerAccountRecord = {
  id: string
  nickname: string
  passwordHash: string
  createdAt: string
}

export type ClickerCloudSave = { raw: string; savedAt: number; updatedAt: string }

async function readRecord<T>(key: string, file: string): Promise<T | null> {
  const layers = await readSharedLayers<T>(key, () => readJsonFile<T>(file))
  if (layers.unreliable && !layers.blob && !layers.cache && !layers.file && !layers.snapshot) {
    throw new Error("저장소에 잠시 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.")
  }
  return layers.blob ?? layers.cache ?? layers.file ?? layers.snapshot
}

const accountKey = (nickname: string) => `clicker-accounts/${nicknameKey(nickname)}`
const accountFile = (nickname: string) => sharedFilePath("clicker-accounts", `${nicknameKey(nickname)}.json`)
const saveKey = (id: string) => `clicker-saves/${id}`
const saveFile = (id: string) => sharedFilePath("clicker-saves", `${id}.json`)

export function findClickerAccount(nickname: string): Promise<ClickerAccountRecord | null> {
  return readRecord<ClickerAccountRecord>(accountKey(nickname), accountFile(nickname))
}

export async function writeClickerAccount(account: ClickerAccountRecord): Promise<void> {
  await writeSharedJson(accountKey(account.nickname), account, () => writeJsonFile(accountFile(account.nickname), account))
}

export function readClickerCloudSave(id: string): Promise<ClickerCloudSave | null> {
  return readRecord<ClickerCloudSave>(saveKey(id), saveFile(id))
}

export async function writeClickerCloudSave(id: string, save: ClickerCloudSave): Promise<void> {
  await writeSharedJson(saveKey(id), save, () => writeJsonFile(saveFile(id), save))
}
