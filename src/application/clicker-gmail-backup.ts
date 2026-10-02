import { extractSaveCodeCandidates } from "../domain/services/clicker-save-extract.ts"
import { SAVE_CODE_PREFIX, type ParsedSaveCode } from "../domain/services/clicker-save-transfer.ts"
import {
  CLOUD_SAVE_MAX_CODE_LENGTH,
  type CloudSaveAvailability,
} from "../domain/services/clicker-cloud-save.ts"
import {
  checkRecipient,
  planBackup,
  type BackupChannel,
  type BackupPlan,
  type BackupSummary,
} from "../domain/services/clicker-gmail-backup.ts"
import type {
  ClipboardPort,
  CloudLoadResult,
  CloudSaveResult,
  FileDownloadPort,
  MailComposerPort,
  SaveRepository,
} from "./clicker-backup-ports.ts"

type ParseCode = (code: string) => ParsedSaveCode

/**
 * Read a pasted save code, or a whole backup e-mail / chat message that contains one.
 * Plain codes and raw JSON go through the normal parser first, so nothing that worked
 * before changes; only on failure do we look for a code inside the surrounding text.
 */
export function parseSavePaste(text: string, parse: ParseCode): ParsedSaveCode {
  const direct = parse(text)
  if (direct.ok) return direct
  if (!text.includes(SAVE_CODE_PREFIX)) return direct
  for (const candidate of extractSaveCodeCandidates(text)) {
    const found = parse(candidate)
    if (found.ok) return found
  }
  return direct
}

export type MailBackupOutcome =
  | {
      ok: true
      plan: BackupPlan
      /** The compose window was opened (false: popup blocked — offer the link). */
      opened: boolean
      /** Code is on the clipboard. */
      copied: boolean
      /** Fallback file was handed to the browser. */
      downloaded: boolean
    }
  | { ok: false; error: string }

type MailBackupDeps = {
  mail: MailComposerPort
  clipboard: ClipboardPort
  files: FileDownloadPort
  now: () => number
}

/**
 * "Send my save code to my mail" — opens a compose window the player sends themselves.
 * When the code does not fit in the URL, the code goes to the clipboard and a file is
 * downloaded instead. Everything user-gesture-sensitive is started before the first await.
 */
export class MailBackupService {
  private readonly deps: MailBackupDeps
  constructor(deps: MailBackupDeps) {
    this.deps = deps
  }

  async start(args: {
    channel: BackupChannel
    recipient: string
    code: string | null
    summary: BackupSummary | null
  }): Promise<MailBackupOutcome> {
    const to = checkRecipient(args.recipient)
    if (!to.ok) return { ok: false, error: to.error }
    if (!args.code) return { ok: false, error: "저장할 진행이 아직 없습니다." }

    const plan = planBackup({
      channel: args.channel,
      to: to.address,
      code: args.code,
      summary: args.summary,
      now: this.deps.now(),
    })

    const needsFallback = plan.mode === "clipboard"
    const copying = needsFallback ? this.deps.clipboard.writeText(plan.code) : null
    const downloaded = needsFallback ? this.deps.files.download(plan.fileName, plan.code + "\n") : false
    const opened = this.deps.mail.open(plan.url, plan.channel)
    const copied = copying ? await copying.catch(() => false) : false
    return { ok: true, plan, opened, copied, downloaded }
  }
}

export type CloudPull =
  | { status: "found"; parsed: Extract<ParsedSaveCode, { ok: true }>; updatedAt: number }
  | { status: "empty" | "signed-out" | "unavailable" }
  | { status: "error"; message: string }

/** Save/load the run through a SaveRepository (Google-signed-in server copy). */
export class CloudSaveService {
  private readonly repo: SaveRepository
  private readonly parse: ParseCode
  constructor(repo: SaveRepository, parse: ParseCode) {
    this.repo = repo
    this.parse = parse
  }

  availability(): Promise<CloudSaveAvailability> {
    return this.repo.availability().catch(() => ({ state: "unavailable" }) as const)
  }

  async push(code: string | null): Promise<CloudSaveResult> {
    if (!code) return { status: "error", message: "저장할 진행이 아직 없습니다." }
    if (code.length > CLOUD_SAVE_MAX_CODE_LENGTH) return { status: "error", message: "세이브가 너무 커서 올릴 수 없습니다." }
    const parsed = this.parse(code)
    if (!parsed.ok) return { status: "error", message: parsed.error }
    try {
      return await this.repo.save({ code, savedAt: parsed.summary.savedAt })
    } catch {
      return { status: "error", message: "서버에 연결하지 못했습니다." }
    }
  }

  async pull(): Promise<CloudPull> {
    let result: CloudLoadResult
    try {
      result = await this.repo.load()
    } catch {
      return { status: "error", message: "서버에 연결하지 못했습니다." }
    }
    if (result.status !== "found") return result
    const parsed = this.parse(result.record.code)
    if (!parsed.ok) return { status: "error", message: "서버에 있는 세이브를 읽을 수 없습니다." }
    return { status: "found", parsed, updatedAt: result.record.updatedAt }
  }
}
