import type { MetaState } from "../entities/clicker.ts"

export type ClickerCompletionRecord = {
  completedAt: number
  playTimeMs: number
  totalCoreEnergy: number
  rebirthCount: number
  worldlinesOwned: number
  clicks: number
}

export function clickerPlayTimeMs(meta: Pick<MetaState, "startedAt" | "completedAt">): number | null {
  if (
    typeof meta.startedAt !== "number" ||
    !Number.isFinite(meta.startedAt) ||
    typeof meta.completedAt !== "number" ||
    !Number.isFinite(meta.completedAt) ||
    meta.completedAt < meta.startedAt
  ) {
    return null
  }
  return meta.completedAt - meta.startedAt
}

export function createClickerCompletionRecord(meta: MetaState): ClickerCompletionRecord | null {
  const playTimeMs = clickerPlayTimeMs(meta)
  if (!meta.gameCompleted || meta.completedAt === null || playTimeMs === null) return null
  return {
    completedAt: meta.completedAt,
    playTimeMs,
    totalCoreEnergy: meta.totalCoreEnergy,
    rebirthCount: meta.rebirthCount,
    worldlinesOwned: meta.transcendenceIds.length,
    clicks: meta.statistics.clicks,
  }
}

export function isClickerCompletionRecord(value: unknown): value is ClickerCompletionRecord {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  return (
    typeof record.completedAt === "number" &&
    Number.isFinite(record.completedAt) &&
    typeof record.playTimeMs === "number" &&
    Number.isFinite(record.playTimeMs) &&
    record.playTimeMs >= 0 &&
    typeof record.totalCoreEnergy === "number" &&
    Number.isFinite(record.totalCoreEnergy) &&
    typeof record.rebirthCount === "number" &&
    Number.isSafeInteger(record.rebirthCount) &&
    record.rebirthCount >= 0 &&
    typeof record.worldlinesOwned === "number" &&
    Number.isSafeInteger(record.worldlinesOwned) &&
    record.worldlinesOwned >= 0 &&
    typeof record.clicks === "number" &&
    Number.isSafeInteger(record.clicks) &&
    record.clicks >= 0
  )
}

export function sortClickerCompletionRecords(
  records: readonly ClickerCompletionRecord[],
): ClickerCompletionRecord[] {
  return [...records].sort(
    (a, b) => a.playTimeMs - b.playTimeMs || a.completedAt - b.completedAt || b.totalCoreEnergy - a.totalCoreEnergy,
  )
}

export function clickerCompletionRank(
  records: readonly ClickerCompletionRecord[],
  completedAt: number,
): number | null {
  const index = sortClickerCompletionRecords(records).findIndex((record) => record.completedAt === completedAt)
  return index === -1 ? null : index + 1
}

export function formatClickerPlayTime(playTimeMs: number): string {
  if (!Number.isFinite(playTimeMs) || playTimeMs < 0) return "—"
  const totalSeconds = Math.floor(playTimeMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const twoDigits = (value: number) => String(value).padStart(2, "0")
  if (hours > 0) return `${hours}시간 ${twoDigits(minutes)}분 ${twoDigits(seconds)}초`
  if (minutes > 0) return `${minutes}분 ${twoDigits(seconds)}초`
  return `${seconds}초`
}
