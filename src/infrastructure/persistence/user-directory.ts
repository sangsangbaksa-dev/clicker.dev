import path from "node:path"
import { unlink } from "node:fs/promises"
import type { StoredUser } from "@/domain/entities/user"
import { dataPath } from "@/infrastructure/persistence/data-dir"
import {
  dropRosterMembers,
  reviveUsersFromRoster,
} from "@/domain/services/member-roster"
import { persistDurableAccounts, loadDurableAccounts } from "@/infrastructure/persistence/member-accounts"
import {
  loadMemberRoster,
  syncMemberRosterFromUsers,
} from "@/infrastructure/persistence/member-roster"
import {
  applyUserTombstones,
  keepKnownUsers,
  mergeUserDirectories,
  unionUserDirectories,
  type UserDirectory,
} from "@/infrastructure/persistence/shared-merge"
import { SharedStoreUnavailableError } from "@/infrastructure/persistence/shared-store-error"
import {
  peekSnapshot,
  readJsonFile,
  readSharedLayers,
  rememberSnapshot,
  writeBlobBackup,
  writeJsonFile,
  writeSharedJson,
} from "@/infrastructure/persistence/shared-json-store"
import {
  addUserTombstones,
  loadUserTombstones,
} from "@/infrastructure/persistence/user-tombstones"
import {
  runtimeGet,
  runtimeDelete,
  runtimeSet,
} from "@/infrastructure/persistence/runtime-json-store"
import {
  WALDO_OWNER_SEED,
  withWaldoOwnerIndex,
} from "@/infrastructure/persistence/waldo-owner-seed"

const DIRECTORY_KEY = "user-directory"
const RUNTIME_INDEX_KEY = "users-index"
const RUNTIME_PENDING_KEY = "pending-signups"
const runtimeUserKey = (userId: string) => `user:${userId}`

const FILE_DIR = dataPath("users")
const DIRECTORY_FILE = path.join(FILE_DIR, "directory.json")
const INDEX_FILE = path.join(FILE_DIR, "index.json")
const PENDING_FILE = path.join(FILE_DIR, "pending-signups.json")
const NETLIFY_STORE = "sohaengbang-users"

const DIRECTORY_TTL_MS = process.env.VERCEL ? 8_000 : 8_000

type UserIndex = Record<string, string>
type CachedDirectory = {
  loadedAt: number
  dir: UserDirectory
  unreliable: boolean
}

let directoryCache: CachedDirectory | null = null
let directoryInflight: Promise<UserDirectory> | null = null

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

function withWaldo(dir: UserDirectory): UserDirectory {
  const users = { ...dir.users }
  if (!users[WALDO_OWNER_SEED.id]) {
    users[WALDO_OWNER_SEED.id] = WALDO_OWNER_SEED
  }
  return {
    ...dir,
    users,
    index: withWaldoOwnerIndex(dir.index),
  }
}

async function readUserFile(userId: string): Promise<StoredUser | null> {
  return readJsonFile<StoredUser>(path.join(FILE_DIR, `${userId}.json`))
}

async function readDirectoryFromFiles(): Promise<UserDirectory> {
  const stored = await readJsonFile<UserDirectory>(DIRECTORY_FILE)
  if (stored?.users && Object.keys(stored.users).length > 0) {
    return mergeUserDirectories([stored])
  }
  const [index, pending] = await Promise.all([
    readJsonFile<UserIndex>(INDEX_FILE),
    readJsonFile<StoredUser[]>(PENDING_FILE),
  ])
  const ids = new Set<string>([
    ...Object.values(index ?? {}),
    ...(pending ?? []).map((user) => user.id),
  ])
  const users: Record<string, StoredUser> = {}
  await Promise.all(
    [...ids].map(async (id) => {
      const user = await readUserFile(id)
      if (user) users[id] = user
    })
  )
  return mergeUserDirectories([
    {
      index: index ?? {},
      users,
      pending: Array.isArray(pending) ? pending : [],
      deletedIds: stored?.deletedIds ?? [],
      updatedAt: stored?.updatedAt ?? "",
    },
  ])
}

async function readDirectoryFromNetlify(): Promise<UserDirectory | null> {
  if (!shouldUseNetlifyBlobs()) return null
  try {
    const store = await netlifyStore()
    const stored = (await store.get(DIRECTORY_KEY, { type: "json" })) as UserDirectory | null
    const index = ((await store.get("users-index", { type: "json" })) as UserIndex | null) ?? {}
    const pending =
      ((await store.get(RUNTIME_PENDING_KEY, { type: "json" })) as StoredUser[] | null) ?? []
    const ids = new Set<string>([
      ...Object.keys(stored?.users ?? {}),
      ...Object.values(index),
      ...pending.map((user) => user.id),
    ])
    const users: Record<string, StoredUser> = { ...(stored?.users ?? {}) }
    await Promise.all(
      [...ids].map(async (id) => {
        if (users[id]) return
        const value = await store.get(`user:${id}`, { type: "json" })
        if (value) users[id] = value as StoredUser
      })
    )
    return mergeUserDirectories([
      stored,
      {
        index,
        users,
        pending,
        deletedIds: stored?.deletedIds ?? [],
        updatedAt: stored?.updatedAt ?? "",
      },
    ])
  } catch {
    return null
  }
}

async function writeDirectoryToNetlify(dir: UserDirectory): Promise<void> {
  if (!shouldUseNetlifyBlobs()) return
  try {
    const store = await netlifyStore()
    await store.setJSON(DIRECTORY_KEY, dir)
    await store.setJSON("users-index", dir.index)
    await store.setJSON(RUNTIME_PENDING_KEY, dir.pending)
    for (const user of Object.values(dir.users)) {
      await store.setJSON(`user:${user.id}`, user)
    }
    for (const id of dir.deletedIds) {
      await store.delete(`user:${id}`).catch(() => undefined)
    }
  } catch {
    // Netlify blobs are optional outside Netlify.
  }
}

async function hydrateFromRuntimeKeys(dir: UserDirectory): Promise<UserDirectory> {
  const pending = await runtimeGet<StoredUser[]>(RUNTIME_PENDING_KEY)
  const index = await runtimeGet<UserIndex>(RUNTIME_INDEX_KEY)
  const ids = new Set<string>([
    ...Object.values(dir.index),
    ...Object.keys(dir.users),
    ...Object.values(index ?? {}),
    ...(pending ?? []).map((user) => user.id),
  ])
  const extras: Record<string, StoredUser> = {}
  await Promise.all(
    [...ids].map(async (id) => {
      if (dir.users[id]) return
      const cached = await runtimeGet<StoredUser>(runtimeUserKey(id))
      if (cached) extras[id] = cached
    })
  )
  return mergeUserDirectories([
    dir,
    {
      index: index ?? {},
      users: extras,
      pending: pending ?? [],
      deletedIds: [],
      updatedAt: "",
    },
  ])
}

export function invalidateUserDirectory(): void {
  directoryCache = null
}

export async function loadUserDirectory(options?: {
  fresh?: boolean
}): Promise<UserDirectory> {
  if (
    !options?.fresh &&
    directoryCache &&
    Date.now() - directoryCache.loadedAt < DIRECTORY_TTL_MS
  ) {
    return directoryCache.dir
  }
  if (!options?.fresh && directoryInflight) return directoryInflight

  directoryInflight = (async () => {
    const layers = await readSharedLayers<UserDirectory>(DIRECTORY_KEY, readDirectoryFromFiles)
    const [netlify, tombstones] = await Promise.all([
      readDirectoryFromNetlify(),
      loadUserTombstones(),
    ])
    let dir = mergeUserDirectories([
      layers.file,
      layers.blob,
      layers.cache,
      layers.snapshot,
      netlify,
    ])
    dir = await hydrateFromRuntimeKeys(dir)
    dir = applyUserTombstones(dir, tombstones)
    dir = withWaldo(dir)
    const durable = await loadDurableAccounts({
      listBlobs: Object.keys(dir.users).length <= 5,
    })
    if (Object.keys(durable.users).length > 0) {
      dir = applyUserTombstones(
        unionUserDirectories([
          dir,
          {
            index: {},
            users: durable.users,
            pending: [],
            deletedIds: [],
            updatedAt: durable.updatedAt,
          },
        ]),
        [...dir.deletedIds, ...tombstones]
      )
    }
    const roster = await loadMemberRoster()
    const revived = reviveUsersFromRoster(dir.users, dir.deletedIds, roster)
    dir = mergeUserDirectories([
      {
        ...dir,
        users: revived.users,
        deletedIds: revived.deletedIds,
      },
    ])
    dir = applyUserTombstones(dir, tombstones)
    if (layers.snapshot) {
      dir = applyUserTombstones(keepKnownUsers(layers.snapshot, dir), dir.deletedIds)
    }
    dir = withWaldo(dir)
    rememberSnapshot(DIRECTORY_KEY, dir)
    directoryCache = { loadedAt: Date.now(), dir, unreliable: layers.unreliable }
    if (!layers.unreliable) {
      const rosterMissing = Object.values(dir.users).some((user) => !roster.users[user.id])
      const durableMissing = Object.values(dir.users).some((user) => !durable.users[user.id])
      if (rosterMissing) {
        void syncMemberRosterFromUsers(dir.users, dir.updatedAt, dir.deletedIds)
      }
      if (durableMissing) {
        void persistDurableAccounts(dir.users, dir.deletedIds)
      }
    }
    return dir
  })().finally(() => {
    directoryInflight = null
  })

  return directoryInflight
}

export async function saveUserDirectory(next: UserDirectory): Promise<UserDirectory> {
  const previous = peekSnapshot<UserDirectory>(DIRECTORY_KEY)
  const current = await loadUserDirectory({ fresh: true })
  if (directoryCache?.unreliable) {
    throw new SharedStoreUnavailableError(
      "회원 데이터를 불러오지 못해 저장하지 않았습니다."
    )
  }
  let merged = keepKnownUsers(current, mergeUserDirectories([current, next]))
  if (previous) merged = keepKnownUsers(previous, merged)
  const tombstones = await addUserTombstones(next.deletedIds)
  merged = applyUserTombstones(merged, tombstones)
  const roster = dropRosterMembers(await loadMemberRoster(), merged.deletedIds)
  const revived = reviveUsersFromRoster(merged.users, merged.deletedIds, roster)
  merged = mergeUserDirectories([
    {
      ...merged,
      users: revived.users,
      deletedIds: revived.deletedIds,
    },
  ])
  merged = withWaldo(applyUserTombstones({ ...merged, updatedAt: new Date().toISOString() }, tombstones))
  directoryCache = { loadedAt: Date.now(), dir: merged, unreliable: false }
  rememberSnapshot(DIRECTORY_KEY, merged)

  await writeSharedJson(DIRECTORY_KEY, merged, async () => {
    await writeJsonFile(DIRECTORY_FILE, merged)
    await writeJsonFile(INDEX_FILE, merged.index)
    await writeJsonFile(PENDING_FILE, merged.pending)
    await Promise.all(
      Object.values(merged.users).map((user) =>
        writeJsonFile(path.join(FILE_DIR, `${user.id}.json`), user)
      )
    )
    await Promise.all(
      merged.deletedIds.map(async (id) => {
        try {
          await unlink(path.join(FILE_DIR, `${id}.json`))
        } catch {
          // already gone
        }
      })
    )
  })
  const backupKey = `backups/user-directory/${merged.updatedAt.replace(/[:.]/g, "-")}`
  await Promise.all([
    runtimeSet(RUNTIME_INDEX_KEY, merged.index),
    runtimeSet(RUNTIME_PENDING_KEY, merged.pending),
    ...Object.values(merged.users).map((user) => runtimeSet(runtimeUserKey(user.id), user)),
    ...merged.deletedIds.map((id) => runtimeDelete(runtimeUserKey(id))),
    writeDirectoryToNetlify(merged),
    writeBlobBackup(backupKey, merged),
    persistDurableAccounts(merged.users, merged.deletedIds),
    syncMemberRosterFromUsers(merged.users, merged.updatedAt, merged.deletedIds),
  ])
  return merged
}

export async function getDeletedUserIds(): Promise<Set<string>> {
  const dir = await loadUserDirectory()
  return new Set(dir.deletedIds)
}
