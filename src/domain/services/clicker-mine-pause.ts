import type { RunState, SaveData } from "../entities/clicker.ts"

export function clearMinePause(run: RunState): RunState {
  return { ...run, minePausedRemainMs: 0 }
}

/** Active timed session in the mine chamber (not paused on hub). */
export function isLiveMineSession(save: SaveData, now: number): boolean {
  return save.settings.playSurface === "mine" && save.runState.mineSessionEndsAt > now
}

export function isMinePaused(save: SaveData): boolean {
  return (save.runState.minePausedRemainMs ?? 0) > 0 && save.settings.playSurface !== "mine"
}

export function pauseMine(save: SaveData, now: number): SaveData {
  if (!isLiveMineSession(save, now)) return save
  const remain = Math.max(0, save.runState.mineSessionEndsAt - now)
  return {
    ...save,
    settings: { ...save.settings, playSurface: "hub" },
    runState: {
      ...save.runState,
      minePausedRemainMs: remain,
      mineSessionEndsAt: 0,
    },
  }
}

export function resumeMine(save: SaveData, now: number): SaveData {
  const remain = save.runState.minePausedRemainMs ?? 0
  if (remain <= 0) return save
  if (isLiveMineSession(save, now)) return save
  return {
    ...save,
    settings: { ...save.settings, playSurface: "mine" },
    runState: {
      ...save.runState,
      mineSessionEndsAt: now + remain,
      minePausedRemainMs: 0,
    },
  }
}

/** Badge text for the Mine nav tab while paused; null when not paused. */
export function formatMinePauseBadge(remainMs: number): string | null {
  if (remainMs <= 0) return null
  const label =
    remainMs >= 60_000
      ? (() => {
          const totalSec = Math.ceil(remainMs / 1000)
          const m = Math.floor(totalSec / 60)
          const s = totalSec % 60
          return `${m}:${String(s).padStart(2, "0")}`
        })()
      : `${Math.ceil(remainMs / 1000)}s`
  return `일시정지 ${label}`
}
