/**
 * 기록실 (pure): one line per finished worldline — time taken, best combo, transcendence picked —
 * and the "나의 세계선" summary after the ending. Called by the application on rebirth / true ending.
 */
import type { ChronicleEntry, MetaState, RunState } from "../entities/clicker.ts"
import { postgameCompleted } from "./clicker-postgame.ts"

export const CHRONICLE_MAX_ENTRIES = 64

export function chronicleEntries(meta: MetaState): ChronicleEntry[] {
  return meta.chronicle ?? []
}

/** Append the worldline that `run` just finished. Idempotent per worldline number. */
export function recordWorldline(meta: MetaState, run: RunState, transcendenceId: string | null, now: number): MetaState {
  const list = chronicleEntries(meta)
  if (list.some((e) => e.worldLine === run.currentWorldLine)) return meta
  const entry: ChronicleEntry = {
    worldLine: run.currentWorldLine,
    transcendenceId,
    startedAt: run.runStartedAt,
    endedAt: Math.max(now, run.runStartedAt),
    maxCombo: meta.statistics.maxCombo,
    lifetimeCore: run.lifetimeCoreEnergy,
  }
  return { ...meta, chronicle: [...list, entry].slice(-CHRONICLE_MAX_ENTRIES) }
}

export function worldlineDurationMs(entry: ChronicleEntry): number {
  return Math.max(0, entry.endedAt - entry.startedAt)
}

export type ChronicleSummary = {
  worldlines: number
  totalMs: number
  fastest: ChronicleEntry | null
  bestCombo: number
  /** The summary card ("나의 세계선") is shown once the ending is done. */
  complete: boolean
}

export function chronicleSummary(meta: MetaState): ChronicleSummary {
  const list = chronicleEntries(meta)
  let fastest: ChronicleEntry | null = null
  for (const e of list) if (!fastest || worldlineDurationMs(e) < worldlineDurationMs(fastest)) fastest = e
  return {
    worldlines: list.length,
    totalMs: list.reduce((s, e) => s + worldlineDurationMs(e), 0),
    fastest,
    bestCombo: list.reduce((m, e) => Math.max(m, e.maxCombo), 0),
    complete: postgameCompleted(meta),
  }
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null)

/** Save-load guard: keep well-formed entries only. */
export function sanitizeChronicle(raw: unknown): ChronicleEntry[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: ChronicleEntry[] = []
  for (const r of raw) {
    if (!r || typeof r !== "object") continue
    const e = r as Record<string, unknown>
    const worldLine = num(e.worldLine), startedAt = num(e.startedAt), endedAt = num(e.endedAt)
    if (worldLine === null || startedAt === null || endedAt === null) continue
    out.push({
      worldLine: Math.floor(worldLine),
      transcendenceId: typeof e.transcendenceId === "string" ? e.transcendenceId : null,
      startedAt,
      endedAt,
      maxCombo: num(e.maxCombo) ?? 0,
      lifetimeCore: num(e.lifetimeCore) ?? 0,
    })
  }
  return out.slice(-CHRONICLE_MAX_ENTRIES)
}
