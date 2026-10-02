import type {
  CloudSaveAvailability,
  CloudSaveRecord,
} from "../domain/services/clicker-cloud-save.ts"
import type { BackupChannel } from "../domain/services/clicker-gmail-backup.ts"

/** Outcome of reading the account copy of the save. */
export type CloudLoadResult =
  | { status: "found"; record: CloudSaveRecord }
  | { status: "empty" }
  | { status: "signed-out" }
  | { status: "unavailable" }
  | { status: "error"; message: string }

export type CloudSaveResult =
  | { status: "saved"; updatedAt: number }
  | { status: "signed-out" }
  | { status: "unavailable" }
  | { status: "error"; message: string }

/**
 * Where a signed-in player's save lives on a server. The game only knows this port; the
 * HTTP adapter (infrastructure/cloud) or any other backend can sit behind it. The adapter
 * owns authentication — the application layer never sees a token or cookie.
 */
export interface SaveRepository {
  availability(): Promise<CloudSaveAvailability>
  load(): Promise<CloudLoadResult>
  save(record: { code: string; savedAt: number }): Promise<CloudSaveResult>
}

/** Opens the compose window. Returns false when the browser refused (popup blocker). */
export interface MailComposerPort {
  open(url: string, channel: BackupChannel): boolean
}

export interface ClipboardPort {
  writeText(text: string): Promise<boolean>
}

export interface FileDownloadPort {
  download(fileName: string, text: string): boolean
}
