import { clickerPlayTimeMs } from "./clicker-completion-records.ts"

/*
 * Online ranking. Every logged-in cloud upload refreshes the player's row from the save the
 * server just accepted (never from numbers the client claims), so the board is only as
 * forgeable as a save file. Two boards read the same rows: fastest clear, and lifetime CORE.
 */

export type LeaderboardEntry = {
  accountId: string
  nickname: string
  totalCore: number
  rebirthCount: number
  worldlinesOwned: number
  /** Play time when the true ending was sealed; null while the run is unfinished. */
  clearMs: number | null
  completedAt: number | null
  /** Play time so far (start → last upload, or → completion). */
  playTimeMs: number | null
  updatedAt: number
}

export type Leaderboard = { entries: LeaderboardEntry[] }
export type LeaderboardKind = "clear" | "core"

/** Rows kept on the board (the slowest / least progressed fall off). */
export const LEADERBOARD_MAX_ENTRIES = 500
export const LEADERBOARD_TOP = 20

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null)

/** A board row from a stored save JSON, or null when the save can't be read. */
export function leaderboardEntryFromSave(
  json: string,
  account: { id: string; nickname: string },
  now: number,
): LeaderboardEntry | null {
  let meta: Record<string, unknown>
  try {
    meta = (JSON.parse(json) as { metaState?: Record<string, unknown> })?.metaState ?? {}
  } catch {
    return null
  }
  const totalCore = num(meta.totalCoreEnergy)
  if (totalCore === null || totalCore < 0) return null
  const startedAt = num(meta.startedAt)
  const completedAt = meta.gameCompleted === true ? num(meta.completedAt) : null
  const clearMs = completedAt !== null ? clickerPlayTimeMs({ startedAt, completedAt }) : null
  const ids = Array.isArray(meta.transcendenceIds) ? meta.transcendenceIds : []
  return {
    accountId: account.id,
    nickname: account.nickname.slice(0, 24) || "익명",
    totalCore,
    rebirthCount: Math.max(0, Math.floor(num(meta.rebirthCount) ?? 0)),
    worldlinesOwned: ids.length,
    clearMs,
    completedAt: clearMs !== null ? completedAt : null,
    playTimeMs: startedAt !== null && startedAt <= (completedAt ?? now) ? (completedAt ?? now) - startedAt : null,
    updatedAt: now,
  }
}

function sortKey(kind: LeaderboardKind) {
  return kind === "clear"
    ? (a: LeaderboardEntry, b: LeaderboardEntry) => (a.clearMs ?? Infinity) - (b.clearMs ?? Infinity) || (a.completedAt ?? 0) - (b.completedAt ?? 0)
    : (a: LeaderboardEntry, b: LeaderboardEntry) => b.totalCore - a.totalCore || a.updatedAt - b.updatedAt
}

/**
 * Replace the player's row. A sealed clear is kept when a later upload (a fresh run after the
 * ending) hasn't cleared yet or cleared slower — the board remembers a player's best.
 */
export function upsertLeaderboard(board: Leaderboard, entry: LeaderboardEntry): Leaderboard {
  const prev = board.entries.find((e) => e.accountId === entry.accountId)
  let next = entry
  if (prev?.clearMs != null && (entry.clearMs == null || prev.clearMs < entry.clearMs)) {
    next = { ...entry, clearMs: prev.clearMs, completedAt: prev.completedAt }
  }
  if (prev && prev.totalCore > next.totalCore) next = { ...next, totalCore: prev.totalCore }
  const rest = board.entries.filter((e) => e.accountId !== entry.accountId)
  const entries = [...rest, next]
  if (entries.length <= LEADERBOARD_MAX_ENTRIES) return { entries }
  // Over the cap: keep every clear (fastest first), then the most CORE.
  const clears = entries.filter((e) => e.clearMs != null).sort(sortKey("clear"))
  const others = entries.filter((e) => e.clearMs == null).sort(sortKey("core"))
  return { entries: [...clears, ...others].slice(0, LEADERBOARD_MAX_ENTRIES) }
}

export function rankLeaderboard(board: Leaderboard, kind: LeaderboardKind): LeaderboardEntry[] {
  const rows = kind === "clear" ? board.entries.filter((e) => e.clearMs != null) : board.entries
  return [...rows].sort(sortKey(kind))
}

export type LeaderboardView = {
  kind: LeaderboardKind
  top: Array<LeaderboardEntry & { rank: number }>
  /** The asking player's own row and rank, when they are on this board. */
  me: (LeaderboardEntry & { rank: number }) | null
  total: number
}

export function leaderboardView(board: Leaderboard, kind: LeaderboardKind, accountId?: string | null): LeaderboardView {
  const ranked = rankLeaderboard(board, kind).map((e, i) => ({ ...e, rank: i + 1 }))
  return {
    kind,
    top: ranked.slice(0, LEADERBOARD_TOP),
    me: accountId ? (ranked.find((e) => e.accountId === accountId) ?? null) : null,
    total: ranked.length,
  }
}

/** Rows as served to clients: no account ids except the asker's own flag. */
export function publicLeaderboardRow(e: LeaderboardEntry & { rank: number }, accountId?: string | null) {
  return {
    rank: e.rank,
    nickname: e.nickname,
    totalCore: e.totalCore,
    rebirthCount: e.rebirthCount,
    worldlinesOwned: e.worldlinesOwned,
    clearMs: e.clearMs,
    playTimeMs: e.playTimeMs,
    isMe: Boolean(accountId) && e.accountId === accountId,
  }
}

export type PublicLeaderboardRow = ReturnType<typeof publicLeaderboardRow>
