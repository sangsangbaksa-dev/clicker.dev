import "server-only"

import type { ClickerFeedback } from "@/domain/services/clicker-feedback"
import { SharedStoreUnavailableError } from "@/infrastructure/persistence/shared-store-error"
import {
  durableStorageRequired,
  readJsonFile,
  readSharedLayers,
  rememberSnapshot,
  sharedBlobEnabled,
  sharedFilePath,
  writeJsonFile,
  writeSharedJson,
} from "@/infrastructure/persistence/shared-json-store"

type FeedbackBoard = {
  entries: ClickerFeedback[]
  updatedAt: string
}

const STORE_KEY = "clicker-feedback"
const FILE_PATH = sharedFilePath("clicker-feedback.json")
const MAX_FEEDBACK_ENTRIES = 500

function assertStorageReady(): void {
  if (durableStorageRequired() && !sharedBlobEnabled()) {
    throw new SharedStoreUnavailableError("피드백 저장소가 설정되지 않았습니다.")
  }
}

function asFeedbackBoard(value: unknown): FeedbackBoard | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const record = value as { entries?: unknown; updatedAt?: unknown }
  if (!Array.isArray(record.entries)) return null
  const entries = record.entries.filter((entry): entry is ClickerFeedback => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false
    const item = entry as Partial<ClickerFeedback>
    return (
      typeof item.id === "string" &&
      (item.category === "bug" || item.category === "idea" || item.category === "other") &&
      typeof item.message === "string" &&
      typeof item.author === "string" &&
      typeof item.createdAt === "string"
    )
  })
  return {
    entries,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
  }
}

function mergeBoards(boards: Array<FeedbackBoard | null>): FeedbackBoard {
  const entries = new Map<string, ClickerFeedback>()
  for (const board of boards) {
    for (const entry of board?.entries ?? []) {
      const current = entries.get(entry.id)
      if (!current || entry.createdAt >= current.createdAt) entries.set(entry.id, entry)
    }
  }
  return {
    entries: [...entries.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, MAX_FEEDBACK_ENTRIES),
    updatedAt: boards.reduce((latest, board) => {
      const updatedAt = board?.updatedAt ?? ""
      return updatedAt > latest ? updatedAt : latest
    }, ""),
  }
}

async function readBoard(): Promise<FeedbackBoard> {
  assertStorageReady()
  const layers = await readSharedLayers<FeedbackBoard>(STORE_KEY, () =>
    readJsonFile<FeedbackBoard>(FILE_PATH)
  )
  if (layers.unreliable) {
    throw new SharedStoreUnavailableError("피드백을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.")
  }
  const board = mergeBoards([
    asFeedbackBoard(layers.file),
    asFeedbackBoard(layers.blob),
    asFeedbackBoard(layers.cache),
    asFeedbackBoard(layers.snapshot),
  ])
  rememberSnapshot(STORE_KEY, board)
  return board
}

export async function listClickerFeedback(): Promise<ClickerFeedback[]> {
  return (await readBoard()).entries
}

export async function addClickerFeedback(feedback: ClickerFeedback): Promise<void> {
  const current = await readBoard()
  const next = mergeBoards([
    {
      entries: [feedback, ...current.entries],
      updatedAt: new Date().toISOString(),
    },
  ])
  rememberSnapshot(STORE_KEY, next)
  await writeSharedJson(STORE_KEY, next, () => writeJsonFile(FILE_PATH, next))
}
