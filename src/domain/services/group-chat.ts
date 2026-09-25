import type {
  ClassGroup,
  GroupChatImageMime,
  GroupMessage,
  GroupMessageImage,
  GroupTyping,
  GroupTypingSurface,
} from "@/domain/entities/board"

export const MAX_GROUP_MESSAGES = 200
export const MAX_MESSAGE_BODY = 2_000
export const MAX_CHAT_IMAGE_BYTES = 2_000_000
export const TYPING_TTL_MS = 4_000
export const GROUP_CHAT_IMAGE_MIMES: readonly GroupChatImageMime[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]

export function canReadGroupChat(
  group: Pick<ClassGroup, "memberIds">,
  userId: string,
  _isAdmin = false
): boolean {
  const id = userId.trim()
  if (!id) return false
  return group.memberIds.includes(id)
}

export function canPostGroupChat(
  group: Pick<ClassGroup, "memberIds">,
  userId: string,
  isAdmin: boolean
): boolean {
  return canReadGroupChat(group, userId, isAdmin)
}

export function sniffGroupChatImage(bytes: Uint8Array): GroupChatImageMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg"
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png"
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  ) {
    return "image/gif"
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp"
  }
  return null
}

export function inspectGroupChatImage(
  bytes: Uint8Array
): { ok: true; mime: GroupChatImageMime } | { ok: false; error: string } {
  if (bytes.length === 0) return { ok: false, error: "사진이 비어 있습니다." }
  if (bytes.length > MAX_CHAT_IMAGE_BYTES) return { ok: false, error: "사진이 너무 큽니다." }
  const mime = sniffGroupChatImage(bytes)
  if (!mime) return { ok: false, error: "jpg, png, webp, gif만 올릴 수 있습니다." }
  return { ok: true, mime }
}

export function sanitizeGroupMessages(raw: unknown): GroupMessage[] {
  if (!Array.isArray(raw)) return []
  const messages: GroupMessage[] = []
  const seen = new Set<string>()
  for (const item of raw.slice(-MAX_GROUP_MESSAGES * 2)) {
    if (!item || typeof item !== "object") continue
    const row = item as Partial<GroupMessage>
    const id = String(row.id ?? "").trim()
    const authorId = String(row.authorId ?? "").trim()
    if (!id || seen.has(id) || !authorId) continue
    seen.add(id)
    const image = sanitizeImage(row.image)
    const body = String(row.body ?? "").slice(0, MAX_MESSAGE_BODY)
    if (!body.trim() && !image) continue
    messages.push({
      id,
      authorId,
      author: String(row.author ?? "").slice(0, 20),
      body,
      createdAt: String(row.createdAt ?? ""),
      ...(image ? { image } : {}),
    })
    if (messages.length >= MAX_GROUP_MESSAGES) break
  }
  return messages.slice(-MAX_GROUP_MESSAGES)
}

function sanitizeImage(raw: unknown): GroupMessageImage | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const mime = String((raw as { mime?: string }).mime ?? "")
  if (!GROUP_CHAT_IMAGE_MIMES.includes(mime as GroupChatImageMime)) return undefined
  return { mime: mime as GroupChatImageMime }
}

export function messagesStamp(messages: GroupMessage[]): string {
  const last = messages[messages.length - 1]
  return `${messages.length}:${last?.id ?? ""}:${last?.createdAt ?? ""}`
}

export function sanitizeTyping(raw: unknown, nowMs = Date.now()): GroupTyping[] {
  if (!Array.isArray(raw)) return []
  const byUser = new Map<string, GroupTyping>()
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const row = item as Partial<GroupTyping>
    const userId = String(row.userId ?? "").trim()
    const at = String(row.at ?? "")
    const atMs = new Date(at).getTime()
    if (!userId || Number.isNaN(atMs) || nowMs - atMs > TYPING_TTL_MS) continue
    const surface: GroupTypingSurface = row.surface === "docs" ? "docs" : "chat"
    byUser.set(`${userId}:${surface}`, {
      userId,
      name: String(row.name ?? "").slice(0, 20),
      at,
      surface,
    })
  }
  return [...byUser.values()]
}

export function setTyping(
  typing: GroupTyping[],
  actor: { id: string; name: string },
  surface: GroupTypingSurface,
  at = new Date().toISOString()
): GroupTyping[] {
  const next = sanitizeTyping(typing).filter(
    (item) => !(item.userId === actor.id && item.surface === surface)
  )
  next.push({ userId: actor.id, name: actor.name.slice(0, 20), at, surface })
  return sanitizeTyping(next)
}

export function clearTyping(typing: GroupTyping[], userId: string, surface?: GroupTypingSurface): GroupTyping[] {
  return sanitizeTyping(typing).filter((item) => {
    if (item.userId !== userId) return true
    if (surface && item.surface !== surface) return true
    return false
  })
}

export function preserveGroupMessages(
  previous: ClassGroup[],
  incoming: ClassGroup[]
): ClassGroup[] {
  const previousById = new Map(previous.map((group) => [group.id, group]))
  return incoming.map((group) => {
    const stored = previousById.get(group.id)
    return {
      ...group,
      messages: stored ? sanitizeGroupMessages(stored.messages) : sanitizeGroupMessages(group.messages),
      typing: stored ? sanitizeTyping(stored.typing) : sanitizeTyping(group.typing),
    }
  })
}

export function hydrateGroupMessages(groups: ClassGroup[], raw: unknown): ClassGroup[] {
  const byId = new Map<string, unknown>()
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue
      const id = String((item as { id?: string }).id ?? "").trim()
      if (id) byId.set(id, item)
    }
  }
  return groups.map((group) => {
    const row = byId.get(group.id) as { messages?: unknown; typing?: unknown } | undefined
    return {
      ...group,
      messages: sanitizeGroupMessages(row?.messages),
      typing: sanitizeTyping(row?.typing),
    }
  })
}

export function appendGroupMessage(
  groups: ClassGroup[],
  groupId: string,
  message: GroupMessage
): ClassGroup[] {
  return groups.map((group) => {
    if (group.id !== groupId) return group
    const next = sanitizeGroupMessages([...sanitizeGroupMessages(group.messages), message])
    return {
      ...group,
      messages: next,
      typing: clearTyping(group.typing, message.authorId, "chat"),
    }
  })
}

export function groupsWithoutChats(groups: ClassGroup[]): ClassGroup[] {
  return groups.map((group) => ({ ...group, messages: [], typing: [] }))
}

export function chatTitle(group: Pick<ClassGroup, "n" | "name">): string {
  const extra = group.name.trim()
  if (!extra || extra === `${group.n}조`) return `${group.n}조 대화`
  return `${group.n}조 ${extra} 대화`
}
