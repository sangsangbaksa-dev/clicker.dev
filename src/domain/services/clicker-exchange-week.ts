/** 세계선 교환소 weekly counter (pure, no engine import so sanitizeSave can use it). */
import type { ExchangeState, MetaState } from "../entities/clicker.ts"

export const EXCHANGE_WEEK_MS = 7 * 24 * 60 * 60 * 1000
/** Weeks start Monday 00:00 KST (epoch 1970-01-05 00:00 KST = Mon). */
const WEEK_ANCHOR_MS = 4 * 24 * 60 * 60 * 1000 - 9 * 60 * 60 * 1000

export function exchangeWeekStart(now: number): number {
  return Math.floor((now - WEEK_ANCHOR_MS) / EXCHANGE_WEEK_MS) * EXCHANGE_WEEK_MS + WEEK_ANCHOR_MS
}

/** This week's counts (an older week reads as empty). */
export function exchangeWeek(meta: MetaState, now: number): ExchangeState {
  const start = exchangeWeekStart(now)
  return meta.exchange && meta.exchange.weekStart === start ? meta.exchange : { weekStart: start, bought: {} }
}

/** Save-load guard: keep a well-formed weekly counter, drop anything else. */
export function sanitizeExchange(raw: unknown): ExchangeState | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const r = raw as { weekStart?: unknown; bought?: unknown }
  if (typeof r.weekStart !== "number" || !Number.isFinite(r.weekStart)) return undefined
  const bought: Record<string, number> = {}
  if (r.bought && typeof r.bought === "object") {
    for (const [k, v] of Object.entries(r.bought as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v) && v > 0) bought[k] = Math.floor(v)
    }
  }
  return { weekStart: r.weekStart, bought }
}
