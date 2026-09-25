import type { StoredUser } from "@/domain/entities/user"

export type MemberRoster = {
  users: Record<string, StoredUser>
  deletedIds: string[]
  updatedAt: string
}

export function emptyMemberRoster(updatedAt = ""): MemberRoster {
  return { users: {}, deletedIds: [], updatedAt }
}

export function preferStoredUser(a: StoredUser, b: StoredUser): StoredUser {
  if (a.status === "approved" && b.status !== "approved") return a
  if (b.status === "approved" && a.status !== "approved") return b
  const aTime = a.approvedAt ?? a.createdAt
  const bTime = b.approvedAt ?? b.createdAt
  return bTime >= aTime ? b : a
}

export function mergeTombstoneIds(
  lists: Array<Iterable<string> | null | undefined>
): string[] {
  const ids = new Set<string>()
  for (const list of lists) {
    if (!list) continue
    for (const id of list) {
      if (id) ids.add(id)
    }
  }
  return [...ids].sort()
}

export function mergeMemberRosters(
  rosters: Array<MemberRoster | null | undefined>
): MemberRoster {
  const deletedIds = mergeTombstoneIds(rosters.map((roster) => roster?.deletedIds))
  const deleted = new Set(deletedIds)
  const users: Record<string, StoredUser> = {}
  let updatedAt = ""
  for (const roster of rosters) {
    if (!roster) continue
    if (roster.updatedAt > updatedAt) updatedAt = roster.updatedAt
    for (const user of Object.values(roster.users ?? {})) {
      if (!user?.id || deleted.has(user.id)) continue
      users[user.id] = users[user.id] ? preferStoredUser(users[user.id], user) : user
    }
  }
  return { users, deletedIds, updatedAt }
}

/** 퇴출·거절된 아이디만 명단에서 뺀다. 빈 저장본으로는 지우지 않는다. */
export function dropRosterMembers(
  roster: MemberRoster,
  expelledIds: Iterable<string>
): MemberRoster {
  const expelled = mergeTombstoneIds([roster.deletedIds, expelledIds])
  if (expelled.length === 0) return roster
  const deleted = new Set(expelled)
  const users = { ...roster.users }
  for (const id of deleted) delete users[id]
  return { users, deletedIds: expelled, updatedAt: roster.updatedAt }
}

export function rosterFromUsers(
  users: Record<string, StoredUser>,
  updatedAt: string,
  deletedIds: Iterable<string> = []
): MemberRoster {
  const nextDeleted = mergeTombstoneIds([deletedIds])
  const deleted = new Set(nextDeleted)
  const nextUsers: Record<string, StoredUser> = {}
  for (const user of Object.values(users)) {
    if (!user?.id || deleted.has(user.id)) continue
    nextUsers[user.id] = user
  }
  return { users: nextUsers, deletedIds: nextDeleted, updatedAt }
}

/**
 * 명단에 있는 계정은 살린다. 다만 퇴출 tombstone(directory 또는 roster)은
 * 번들 JSON·백업보다 우선한다. 빈 user-directory가 전원을 지워도
 * tombstone이 없는 명단 회원은 복구된다.
 */
export function reviveUsersFromRoster(
  users: Record<string, StoredUser>,
  deletedIds: string[],
  roster: MemberRoster
): { users: Record<string, StoredUser>; deletedIds: string[] } {
  const tombstones = mergeTombstoneIds([deletedIds, roster.deletedIds])
  const deleted = new Set(tombstones)
  const nextUsers: Record<string, StoredUser> = {}
  for (const user of Object.values(users)) {
    if (!user?.id || deleted.has(user.id)) continue
    nextUsers[user.id] = user
  }
  for (const user of Object.values(roster.users ?? {})) {
    if (!user?.id || deleted.has(user.id)) continue
    nextUsers[user.id] = nextUsers[user.id]
      ? preferStoredUser(nextUsers[user.id], user)
      : user
  }
  return {
    users: nextUsers,
    deletedIds: tombstones,
  }
}

export function rosterSize(roster: MemberRoster | null | undefined): number {
  return Object.keys(roster?.users ?? {}).length
}

/** Account id index. Sparse deploys cannot drop known ids; 퇴출만 뺀다. */
export type AccountIdList = {
  ids: string[]
  deletedIds: string[]
  updatedAt: string
}

export function emptyAccountIdList(updatedAt = ""): AccountIdList {
  return { ids: [], deletedIds: [], updatedAt }
}

export function mergeAccountIds(
  lists: Array<AccountIdList | string[] | null | undefined>,
  expelledIds: Iterable<string> = []
): AccountIdList {
  const expelled = new Set<string>()
  for (const id of expelledIds) {
    if (id) expelled.add(id)
  }
  const ids: string[] = []
  const seen = new Set<string>()
  let updatedAt = ""
  for (const list of lists) {
    if (!list) continue
    const rows = Array.isArray(list) ? list : list.ids ?? []
    const stamp = Array.isArray(list) ? "" : (list.updatedAt ?? "")
    if (stamp > updatedAt) updatedAt = stamp
    if (!Array.isArray(list)) {
      for (const id of list.deletedIds ?? []) {
        if (id) expelled.add(id)
      }
    }
    for (const id of rows) {
      if (!id || expelled.has(id) || seen.has(id)) continue
      seen.add(id)
      ids.push(id)
    }
  }
  return { ids, deletedIds: [...expelled].sort(), updatedAt }
}
