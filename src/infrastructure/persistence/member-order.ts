import type { PublicUser } from "@/domain/entities/user"
import {
  mergeMemberOrder,
  type MemberOrderDocument,
} from "@/infrastructure/persistence/shared-merge"
import {
  readJsonFile,
  readSharedLayers,
  rememberSnapshot,
  sharedFilePath,
  writeJsonFile,
  writeSharedJson,
} from "@/infrastructure/persistence/shared-json-store"

const FILE_PATH = sharedFilePath("member-order.json")
const BLOB_KEY = "member-order"
const NETLIFY_STORE = "sohaengbang-users"

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

function normalizeDoc(raw: Partial<MemberOrderDocument> | null): MemberOrderDocument | null {
  if (!raw || typeof raw !== "object") return null
  return {
    order: Array.isArray(raw.order) ? raw.order.filter(Boolean) : [],
    updatedAt: String(raw.updatedAt ?? ""),
  }
}

async function readFromNetlify(): Promise<MemberOrderDocument | null> {
  if (!shouldUseNetlifyBlobs()) return null
  try {
    const store = await netlifyStore()
    const value = await store.get(BLOB_KEY, { type: "json" })
    return normalizeDoc(value as Partial<MemberOrderDocument> | null)
  } catch {
    return null
  }
}

async function readDocument(): Promise<MemberOrderDocument> {
  const layers = await readSharedLayers<MemberOrderDocument>(BLOB_KEY, async () =>
    normalizeDoc(await readJsonFile<MemberOrderDocument>(FILE_PATH))
  )
  const netlify = await readFromNetlify()
  const doc = mergeMemberOrder([layers.file, layers.blob, layers.cache, layers.snapshot, netlify])
  rememberSnapshot(BLOB_KEY, doc)
  return doc
}

async function writeDocument(doc: MemberOrderDocument): Promise<void> {
  const current = await readDocument()
  const merged = mergeMemberOrder([current, doc])
  rememberSnapshot(BLOB_KEY, merged)
  await writeSharedJson(BLOB_KEY, merged, () => writeJsonFile(FILE_PATH, merged))
  if (shouldUseNetlifyBlobs()) {
    try {
      const store = await netlifyStore()
      await store.setJSON(BLOB_KEY, merged)
    } catch {
      // optional
    }
  }
}

/** 1반 → 4반, 같은 반이면 아이디순 */
export function defaultMemberSort(a: PublicUser, b: PublicUser): number {
  const classA = a.classN ?? 99
  const classB = b.classN ?? 99
  if (classA !== classB) return classA - classB
  return a.loginId.localeCompare(b.loginId, "ko")
}

export function sortMembersByOrder(members: PublicUser[], order: string[]): PublicUser[] {
  if (order.length === 0) {
    return [...members].sort(defaultMemberSort)
  }

  const rank = new Map(order.map((id, index) => [id, index]))
  return [...members].sort((a, b) => {
    const rankA = rank.get(a.id)
    const rankB = rank.get(b.id)
    if (rankA !== undefined && rankB !== undefined) return rankA - rankB
    if (rankA !== undefined) return -1
    if (rankB !== undefined) return 1
    return defaultMemberSort(a, b)
  })
}

export function buildMemberOrder(members: PublicUser[], savedOrder: string[]): string[] {
  const memberIds = new Set(members.map((member) => member.id))
  const next = savedOrder.filter((id) => memberIds.has(id))
  for (const member of sortMembersByOrder(members, [])) {
    if (!next.includes(member.id)) {
      next.push(member.id)
    }
  }
  return next
}

export async function getMemberOrder(): Promise<string[]> {
  const doc = await readDocument()
  return doc.order
}

export async function saveMemberOrder(order: string[]): Promise<string[]> {
  const doc: MemberOrderDocument = {
    order,
    updatedAt: new Date().toISOString(),
  }
  await writeDocument(doc)
  return order
}

export async function removeMemberFromOrder(userId: string): Promise<void> {
  const doc = await readDocument()
  const next = doc.order.filter((id) => id !== userId)
  if (next.length === doc.order.length) return
  await writeDocument({ order: next, updatedAt: new Date().toISOString() })
}

export async function moveMemberInOrder(
  members: PublicUser[],
  userId: string,
  direction: "up" | "down"
): Promise<string[]> {
  const saved = await getMemberOrder()
  const order = buildMemberOrder(members, saved)
  const index = order.indexOf(userId)
  if (index === -1) return order

  const target = direction === "up" ? index - 1 : index + 1
  if (target < 0 || target >= order.length) return order

  const next = [...order]
  ;[next[index], next[target]] = [next[target], next[index]]
  await saveMemberOrder(next)
  return next
}
