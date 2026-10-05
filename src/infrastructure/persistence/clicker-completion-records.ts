import {
  isClickerCompletionRecord,
  sortClickerCompletionRecords,
  type ClickerCompletionRecord,
} from "../../domain/services/clicker-completion-records.ts"
import type { ClickerCompletionRecordsPort } from "../../application/ports/clicker-completion-records.ts"

const KEY = "aurelia-clicker-completions-v1"

export type ClickerCompletionRecordsRead = {
  available: boolean
  records: ClickerCompletionRecord[]
}

function localStore(): Storage | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function readClickerCompletionRecords(): ClickerCompletionRecordsRead {
  const store = localStore()
  if (!store) return { available: false, records: [] }
  try {
    const raw = store.getItem(KEY)
    if (!raw) return { available: true, records: [] }
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return { available: false, records: [] }
    const records = parsed.filter(isClickerCompletionRecord)
    return { available: true, records: sortClickerCompletionRecords(records) }
  } catch {
    return { available: false, records: [] }
  }
}

export function saveClickerCompletionRecord(record: ClickerCompletionRecord): boolean {
  const store = localStore()
  if (!store) return false
  const current = readClickerCompletionRecords()
  if (!current.available) return false
  const records = sortClickerCompletionRecords([
    ...current.records.filter((existing) => existing.completedAt !== record.completedAt),
    record,
  ])
  try {
    store.setItem(KEY, JSON.stringify(records))
    return true
  } catch {
    return false
  }
}

export const browserClickerCompletionRecords: ClickerCompletionRecordsPort = {
  read: readClickerCompletionRecords,
  save: saveClickerCompletionRecord,
}
