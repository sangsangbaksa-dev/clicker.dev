import { formatNumber } from "./clicker-format.ts"

/**
 * Mail-a-backup rules (pure): build the Gmail compose / mailto URL for a save code and
 * decide whether the code fits in the URL or has to travel via clipboard + file.
 * The save code holds game progress only — no passwords or tokens — but it is still the
 * player's data, so nothing here sends anything: it only builds a URL the player opens.
 */
export const GMAIL_COMPOSE_BASE = "https://mail.google.com/mail/"
/** Gmail compose URLs far beyond this get truncated or refused by browsers/proxies. */
export const GMAIL_URL_LIMIT = 6000
/** mailto: handlers (Outlook, some webmail) are much stricter than Gmail. */
export const MAILTO_URL_LIMIT = 1900

export type BackupChannel = "gmail" | "mailto"

export type BackupSummary = {
  coreEnergy: number
  totalCoreEnergy: number
  rebirthCount: number
  savedAt: number
}

export type RecipientCheck = { ok: true; address: string } | { ok: false; error: string }

/** Empty is fine (the player fills "받는 사람" in the mail window); otherwise one plain address. */
export function checkRecipient(input: string): RecipientCheck {
  const address = input.trim()
  if (!address) return { ok: true, address: "" }
  // Strip nothing silently: control characters / separators could smuggle extra headers or recipients.
  if (address.length > 254 || /[\s,;<>()"\\\u0000-\u001f]/.test(address)) {
    return { ok: false, error: "받는 사람은 메일 주소 하나만 입력하세요." }
  }
  if (!/^[^@]+@[^@]+\.[^@.]+$/.test(address)) {
    return { ok: false, error: "메일 주소 형식이 올바르지 않습니다." }
  }
  return { ok: true, address }
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

/** `YYYYMMDD-HHMM` in the viewer's local time. */
export function backupStamp(at: number): string {
  const d = new Date(at)
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

function readableTime(at: number): string {
  const d = new Date(at)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function backupSubject(now: number): string {
  return `[Aurelia Core] 세이브 백업 ${readableTime(now)}`
}

export function backupFileName(now: number): string {
  return `aurelia-core-backup-${backupStamp(now)}.txt`
}

function summaryLines(summary: BackupSummary | null): string[] {
  if (!summary) return []
  return [
    `저장 시각: ${summary.savedAt ? readableTime(summary.savedAt) : "알 수 없음"}`,
    `보유 CORE ${formatNumber(summary.coreEnergy)} · 누적 ${formatNumber(summary.totalCoreEnergy)} · 환생 ${summary.rebirthCount}회`,
    "",
  ]
}

const HOW_TO_RESTORE = "복원: 게임 설정 → 저장 데이터 → 불러오기 칸에 아래 코드(또는 이 메일 본문 전체)를 붙여 넣고 '코드 확인'을 누르세요."
const FOOTER = "※ 코드에는 게임 진행 데이터만 들어 있습니다. 비밀번호나 로그인 정보는 포함되지 않습니다."

/** Body with the code inline. The code sits on its own line, followed by a blank line. */
export function backupBodyInline(code: string, summary: BackupSummary | null): string {
  return ["Aurelia Core 세이브 코드 백업입니다.", ...summaryLines(summary), HOW_TO_RESTORE, "", code, "", FOOTER].join("\n")
}

/** Body when the code is too long for a URL: the player pastes it from the clipboard / attaches the file. */
export function backupBodyWithoutCode(fileName: string, summary: BackupSummary | null): string {
  return [
    "Aurelia Core 세이브 코드 백업입니다.",
    ...summaryLines(summary),
    "코드가 길어 주소에 담지 못했습니다.",
    `1) 클립보드에 복사된 코드를 아래에 붙여 넣기(Ctrl/⌘+V), 또는`,
    `2) 함께 내려받은 파일(${fileName})을 첨부하세요.`,
    "",
    "",
    "",
    HOW_TO_RESTORE,
    FOOTER,
  ].join("\n")
}

export function buildGmailComposeUrl({ to, subject, body }: { to: string; subject: string; body: string }): string {
  const parts = ["view=cm", "fs=1"]
  if (to) parts.push(`to=${encodeURIComponent(to)}`)
  parts.push(`su=${encodeURIComponent(subject)}`, `body=${encodeURIComponent(body)}`)
  return `${GMAIL_COMPOSE_BASE}?${parts.join("&")}`
}

export function buildMailtoUrl({ to, subject, body }: { to: string; subject: string; body: string }): string {
  // Address is validated by checkRecipient (no separators), so only "@" needs to stay readable.
  const addr = to ? encodeURIComponent(to).replace(/%40/g, "@") : ""
  return `mailto:${addr}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export type BackupPlan = {
  channel: BackupChannel
  /** inline: the code is in the mail body. clipboard: the code travels via clipboard + file. */
  mode: "inline" | "clipboard"
  url: string
  /** Always present: the text to put on the clipboard / into the fallback file. */
  code: string
  fileName: string
}

export function planBackup(args: {
  channel: BackupChannel
  to: string
  code: string
  summary: BackupSummary | null
  now: number
}): BackupPlan {
  const { channel, to, code, summary, now } = args
  const subject = backupSubject(now)
  const fileName = backupFileName(now)
  const build = channel === "gmail" ? buildGmailComposeUrl : buildMailtoUrl
  const limit = channel === "gmail" ? GMAIL_URL_LIMIT : MAILTO_URL_LIMIT

  const inline = build({ to, subject, body: backupBodyInline(code, summary) })
  if (inline.length <= limit) return { channel, mode: "inline", url: inline, code, fileName }

  const url = build({ to, subject, body: backupBodyWithoutCode(fileName, summary) })
  return { channel, mode: "clipboard", url, code, fileName }
}
