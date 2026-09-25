import type { StoredUser } from "@/domain/entities/user"
import {
  dropRosterMembers,
  emptyMemberRoster,
  mergeMemberRosters,
  rosterFromUsers,
  rosterSize,
  type MemberRoster,
} from "@/domain/services/member-roster"
import { dataPath } from "@/infrastructure/persistence/data-dir"
import {
  readJsonFile,
  readSharedLayers,
  rememberSnapshot,
  writeJsonFile,
  writeSharedJson,
} from "@/infrastructure/persistence/shared-json-store"
import bundledMembers from "../../../data/members.json"

const BLOB_KEY = "member-roster"
const FILE_PATH = dataPath("members-live.json")

function asRoster(value: unknown): MemberRoster | null {
  if (!value || typeof value !== "object") return null
  const row = value as { users?: unknown; deletedIds?: unknown; updatedAt?: unknown }
  const rawUsers = row.users
  if (!rawUsers || typeof rawUsers !== "object") return null
  const users: Record<string, StoredUser> = {}
  for (const item of Object.values(rawUsers as Record<string, unknown>)) {
    if (!item || typeof item !== "object") continue
    const user = item as StoredUser
    if (!user.id || !user.loginId || !user.passwordHash) continue
    users[user.id] = user
  }
  const deletedIds = Array.isArray(row.deletedIds)
    ? row.deletedIds.filter((id): id is string => typeof id === "string" && Boolean(id))
    : []
  return {
    users,
    deletedIds,
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : "",
  }
}

function bundledRoster(): MemberRoster {
  return asRoster(bundledMembers) ?? emptyMemberRoster()
}

export async function loadMemberRoster(): Promise<MemberRoster> {
  const layers = await readSharedLayers<MemberRoster>(BLOB_KEY, () =>
    readJsonFile<MemberRoster>(FILE_PATH)
  )
  const roster = mergeMemberRosters([
    bundledRoster(),
    asRoster(layers.file),
    asRoster(layers.blob),
    asRoster(layers.cache),
    asRoster(layers.snapshot),
  ])
  rememberSnapshot(BLOB_KEY, roster)
  return roster
}

export async function saveMemberRoster(
  incoming: MemberRoster,
  expelledIds: Iterable<string> = []
): Promise<MemberRoster> {
  const current = await loadMemberRoster()
  const merged = dropRosterMembers(
    mergeMemberRosters([current, incoming]),
    expelledIds
  )
  const next: MemberRoster = {
    ...merged,
    updatedAt: incoming.updatedAt || new Date().toISOString(),
  }
  rememberSnapshot(BLOB_KEY, next)
  await writeSharedJson(BLOB_KEY, next, () => writeJsonFile(FILE_PATH, next))
  return next
}

export async function syncMemberRosterFromUsers(
  users: Record<string, StoredUser>,
  updatedAt: string,
  expelledIds: Iterable<string>
): Promise<MemberRoster> {
  return saveMemberRoster(rosterFromUsers(users, updatedAt), expelledIds)
}

export { rosterSize }
