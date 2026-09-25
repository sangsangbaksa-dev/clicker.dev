import type { ClassGroup } from "@/domain/entities/board"

export const MAX_CLASS_GROUPS = 12
export const MAX_GROUP_MEMBERS = 40

export type GroupPerson = {
  id: string
  name: string
}

export function groupLabel(group: Pick<ClassGroup, "n" | "name">): string {
  const extra = group.name.trim()
  if (!extra || extra === `${group.n}조`) return `${group.n}조`
  return `${group.n}조 ${extra}`
}

export function nextGroupNumber(groups: Pick<ClassGroup, "n">[]): number {
  const used = new Set(groups.map((group) => group.n))
  let n = 1
  while (used.has(n)) n += 1
  return n
}

export function sortGroups(groups: ClassGroup[]): ClassGroup[] {
  return [...groups].sort((a, b) => a.n - b.n || a.createdAt.localeCompare(b.createdAt))
}

function uniqueIds(ids: string[], limit: number): string[] {
  const seen = new Set<string>()
  const next: string[] = []
  for (const raw of ids) {
    const id = String(raw ?? "").trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    next.push(id)
    if (next.length >= limit) break
  }
  return next
}

/** Client/board payloads never carry 조 문서 본문. */
export function sanitizeGroups(raw: unknown): ClassGroup[] {
  if (!Array.isArray(raw)) return []
  const groups: ClassGroup[] = []
  const seenIds = new Set<string>()
  const seenN = new Set<number>()
  for (const item of raw.slice(0, MAX_CLASS_GROUPS)) {
    if (!item || typeof item !== "object") continue
    const row = item as Partial<ClassGroup> & { leaderId?: string; messages?: unknown }
    const id = String(row.id ?? "").trim()
    const n = Number(row.n)
    if (!id || seenIds.has(id)) continue
    if (!Number.isInteger(n) || n < 1 || n > 99 || seenN.has(n)) continue
    seenIds.add(id)
    seenN.add(n)
    groups.push({
      id,
      n,
      name: String(row.name ?? "").trim().slice(0, 20),
      memberIds: uniqueIds(
        Array.isArray(row.memberIds) ? row.memberIds.map(String) : [],
        MAX_GROUP_MEMBERS
      ),
      createdAt: String(row.createdAt ?? ""),
      documents: [],
      messages: [],
      typing: [],
    })
  }
  return sortGroups(groups)
}

/** A student belongs to at most one 조. Later groups win if the payload duplicated them. */
export function exclusiveGroupMembers(groups: ClassGroup[]): ClassGroup[] {
  const claimed = new Set<string>()
  const reversed = [...sortGroups(groups)].reverse()
  const cleaned = reversed.map((group) => {
    const memberIds = group.memberIds.filter((id) => {
      if (claimed.has(id)) return false
      claimed.add(id)
      return true
    })
    return { ...group, memberIds }
  })
  return sortGroups(cleaned)
}

export function addEmptyGroup(
  groups: ClassGroup[],
  id: string,
  createdAt = new Date().toISOString()
): ClassGroup[] {
  const current = exclusiveGroupMembers(sanitizeGroups(groups))
  if (current.length >= MAX_CLASS_GROUPS) return current
  const created: ClassGroup = {
    id,
    n: nextGroupNumber(current),
    name: "",
    memberIds: [],
    createdAt,
    documents: [],
    messages: [],
    typing: [],
  }
  return sortGroups([...current, created])
}

export function removeGroup(groups: ClassGroup[], groupId: string): ClassGroup[] {
  const id = groupId.trim()
  if (!id) return exclusiveGroupMembers(sanitizeGroups(groups))
  return exclusiveGroupMembers(sanitizeGroups(groups)).filter((group) => group.id !== id)
}

/** Local 조 삭제는 유지하고, 다른 컴퓨터가 새로 만든 조만 합친다. */
export function mergeGroupsOnConflict(
  local: ClassGroup[] | undefined,
  remote: ClassGroup[] | undefined,
  base: ClassGroup[] | undefined
): ClassGroup[] {
  const ours = exclusiveGroupMembers(sanitizeGroups(local ?? []))
  const theirs = exclusiveGroupMembers(sanitizeGroups(remote ?? []))
  const previous = exclusiveGroupMembers(sanitizeGroups(base ?? []))
  if (JSON.stringify(ours) === JSON.stringify(previous)) return theirs

  const localIds = new Set(ours.map((group) => group.id))
  const baseIds = new Set(previous.map((group) => group.id))
  const extras = theirs.filter((group) => !localIds.has(group.id) && !baseIds.has(group.id))
  return exclusiveGroupMembers([...ours, ...extras]).slice(0, MAX_CLASS_GROUPS)
}

export function patchGroup(
  groups: ClassGroup[],
  groupId: string,
  patch: { name?: string; memberIds?: string[] }
): ClassGroup[] {
  const current = exclusiveGroupMembers(sanitizeGroups(groups))
  const others = current.filter((group) => group.id !== groupId)
  const target = current.find((group) => group.id === groupId)
  if (!target) return current

  const memberIds = uniqueIds(patch.memberIds ?? target.memberIds, MAX_GROUP_MEMBERS)
  const taken = new Set(memberIds)
  const next: ClassGroup = {
    ...target,
    name: patch.name !== undefined ? String(patch.name).trim().slice(0, 20) : target.name,
    memberIds,
  }

  const rest = others.map((group) => ({
    ...group,
    memberIds: group.memberIds.filter((id) => !taken.has(id)),
  }))

  return exclusiveGroupMembers([...rest, next])
}

export function commitGroupEdit(
  groups: ClassGroup[],
  editor: {
    id: string
    createdAt?: string
    name: string
    memberIds: string[]
  }
): ClassGroup[] {
  const current = exclusiveGroupMembers(sanitizeGroups(groups))
  const base = current.some((group) => group.id === editor.id)
    ? current
    : addEmptyGroup(current, editor.id, editor.createdAt)
  return patchGroup(base, editor.id, {
    name: editor.name,
    memberIds: editor.memberIds,
  })
}

export function dropMemberFromGroups(groups: ClassGroup[], userId: string): ClassGroup[] {
  const id = userId.trim()
  const current = exclusiveGroupMembers(groups)
  if (!id) return current
  return current.map((group) => ({
    ...group,
    memberIds: group.memberIds.filter((memberId) => memberId !== id),
  }))
}

export function ungroupedIds(rosterIds: string[], groups: ClassGroup[]): string[] {
  const taken = new Set(groups.flatMap((group) => group.memberIds))
  return rosterIds.filter((id) => !taken.has(id))
}

export function groupForMember(
  groups: ClassGroup[],
  userId: string
): ClassGroup | undefined {
  const id = userId.trim()
  if (!id) return undefined
  return groups.find((group) => group.memberIds.includes(id))
}

export function groupSummaryLine(
  groups: Array<Pick<ClassGroup, "n" | "name"> & { memberCount?: number; memberIds?: string[] }>
): string {
  const parts = [...groups]
    .sort((a, b) => a.n - b.n)
    .map((group) => {
      const count = group.memberCount ?? group.memberIds?.length ?? 0
      const label = groupLabel(group)
      return count > 0 ? `${label} ${count}` : label
    })
  if (parts.length <= 6) return parts.join(" · ")
  return `${parts.slice(0, 6).join(" · ")} 외 ${parts.length - 6}개`
}

export function personName(people: GroupPerson[], id: string): string {
  return people.find((person) => person.id === id)?.name ?? ""
}
