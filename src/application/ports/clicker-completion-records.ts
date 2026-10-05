import type { ClickerCompletionRecord } from "../../domain/services/clicker-completion-records.ts"

export type ClickerCompletionRecordsPort = {
  read(): { available: boolean; records: ClickerCompletionRecord[] }
  save(record: ClickerCompletionRecord): boolean
}
