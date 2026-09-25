import { readdir, unlink } from "node:fs/promises"
import path from "node:path"
import type { StoredUser } from "@/domain/entities/user"
import {
  mergeAccountIds,
  preferStoredUser,
  type AccountIdList,
} from "@/domain/services/member-roster"
import { dataPath } from "@/infrastructure/persistence/data-dir"
import {
  deleteSharedBlob,
  listSharedBlobs,
  readJsonFile,
  readSharedBlobJson,
  readSharedLayers,
  rememberSnapshot,
  writeJsonFile,
  writeSharedBlobJson,
  writeSharedJson,
} from "@/infrastructure/persistence/shared-json-store"
import { runtimeDelete, runtimeGet, runtimeSet } from "@/infrastructure/persistence/runtime-json-store"

const ID_LIST_KEY = "member-account-ids"
const ID_LIST_FILE = dataPath("accounts", "ids.json")
const FILE_DIR = dataPath("accounts")
const runtimeAccountKey = (id: string) => `account:${id}`
const blobAccountKey = (id: string) => `accounts/${id}`
const accountFile = (id: string) => path.join(FILE_DIR, `${id}.json`)

export type DurableAccounts = {
  users: Record<string, StoredUser>
  ids: string[]
  deletedIds: string[]
  updatedAt: string
}

function asStoredUser(value: unknown): StoredUser | null {
  if (!value || typeof value !== "object") return null
  const row = value as Partial<StoredUser>
  if (typeof row.id !== "string" || !row.id) return null
  if (typeof row.loginId !== "string" || !row.loginId) return null
  if (typeof row.name !== "string" || !row.name) return null
  if (typeof row.passwordHash !== "string" || !row.passwordHash) return null
  if (typeof row.createdAt !== "string" || !row.createdAt) return null
  return value as StoredUser
}

function asAccountIdList(value: unknown): AccountIdList | null {
  if (!value || typeof value !== "object") return null
  const row = value as { ids?: unknown; deletedIds?: unknown; updatedAt?: unknown }
  if (!Array.isArray(row.ids) && !Array.isArray(row.deletedIds)) return null
  const ids = (Array.isArray(row.ids) ? row.ids : []).filter(
    (id): id is string => typeof id === "string" && id.startsWith("usr_")
  )
  const deletedIds = (Array.isArray(row.deletedIds) ? row.deletedIds : []).filter(
    (id): id is string => typeof id === "string" && id.startsWith("usr_")
  )
  return {
    ids,
    deletedIds,
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : "",
  }
}

function idFromAccountPath(pathname: string): string | null {
  const match = pathname.match(/(?:^|\/)accounts\/(usr_[A-Za-z0-9-]+)\.json$/)
  return match?.[1] ?? null
}

function pickUser(...layers: unknown[]): StoredUser | null {
  let best: StoredUser | null = null
  for (const layer of layers) {
    const user = asStoredUser(layer)
    if (!user) continue
    best = best ? preferStoredUser(best, user) : user
  }
  return best
}

async function listLocalAccountIds(): Promise<string[]> {
  try {
    const names = await readdir(FILE_DIR)
    return names
      .filter((name) => name.startsWith("usr_") && name.endsWith(".json"))
      .map((name) => name.slice(0, -".json".length))
  } catch {
    return []
  }
}

async function readAccount(id: string): Promise<StoredUser | null> {
  const [file, blob, cache] = await Promise.all([
    readJsonFile<StoredUser>(accountFile(id)),
    readSharedBlobJson<StoredUser>(blobAccountKey(id)),
    runtimeGet<StoredUser>(runtimeAccountKey(id)),
  ])
  return pickUser(file, blob.value, cache)
}

export async function loadDurableAccounts(options?: {
  listBlobs?: boolean
}): Promise<DurableAccounts> {
  const layers = await readSharedLayers<AccountIdList>(ID_LIST_KEY, () =>
    readJsonFile<AccountIdList>(ID_LIST_FILE)
  )
  const listed = mergeAccountIds([
    asAccountIdList(layers.file),
    asAccountIdList(layers.blob),
    asAccountIdList(layers.cache),
    asAccountIdList(layers.snapshot),
  ])
  const deleted = new Set(listed.deletedIds)
  const ids = new Set(listed.ids)

  const localIds = await listLocalAccountIds()
  for (const id of localIds) {
    if (!deleted.has(id)) ids.add(id)
  }

  if (options?.listBlobs || ids.size === 0) {
    const blobs = await listSharedBlobs("hsms-md/accounts/")
    for (const blob of blobs) {
      const id = idFromAccountPath(blob.pathname)
      if (id && !deleted.has(id)) ids.add(id)
    }
  }

  const users: Record<string, StoredUser> = {}
  await Promise.all(
    [...ids].map(async (id) => {
      if (deleted.has(id)) return
      const user = await readAccount(id)
      if (user && !deleted.has(user.id)) users[user.id] = user
    })
  )

  const nextList = mergeAccountIds([
    listed,
    Object.keys(users),
  ], deleted)
  rememberSnapshot(ID_LIST_KEY, nextList)
  return {
    users,
    ids: nextList.ids,
    deletedIds: nextList.deletedIds,
    updatedAt: nextList.updatedAt || listed.updatedAt,
  }
}

export async function persistDurableAccounts(
  incoming: Record<string, StoredUser>,
  expelledIds: Iterable<string> = []
): Promise<DurableAccounts> {
  const current = await loadDurableAccounts({ listBlobs: false })
  const expelled = new Set([...expelledIds].filter(Boolean))
  const users: Record<string, StoredUser> = {}
  for (const user of Object.values(current.users)) {
    if (!user?.id || expelled.has(user.id)) continue
    users[user.id] = user
  }
  for (const user of Object.values(incoming)) {
    if (!user?.id || expelled.has(user.id)) continue
    users[user.id] = users[user.id] ? preferStoredUser(users[user.id], user) : user
  }
  const idList = mergeAccountIds(
    [
      { ids: current.ids, deletedIds: current.deletedIds, updatedAt: current.updatedAt },
      Object.keys(users),
    ],
    expelled
  )
  const nextList: AccountIdList = {
    ids: idList.ids,
    deletedIds: idList.deletedIds,
    updatedAt: new Date().toISOString(),
  }
  rememberSnapshot(ID_LIST_KEY, nextList)

  await Promise.all([
    writeSharedJson(ID_LIST_KEY, nextList, () => writeJsonFile(ID_LIST_FILE, nextList)),
    ...Object.values(users).map(async (user) => {
      await Promise.all([
        writeJsonFile(accountFile(user.id), user),
        writeSharedBlobJson(blobAccountKey(user.id), user),
        runtimeSet(runtimeAccountKey(user.id), user),
      ])
    }),
    ...[...expelled].map(async (id) => {
      await Promise.all([
        unlink(accountFile(id)).catch(() => undefined),
        deleteSharedBlob(blobAccountKey(id)),
        runtimeDelete(runtimeAccountKey(id)),
      ])
    }),
  ])

  return { users, ids: nextList.ids, deletedIds: nextList.deletedIds, updatedAt: nextList.updatedAt }
}
