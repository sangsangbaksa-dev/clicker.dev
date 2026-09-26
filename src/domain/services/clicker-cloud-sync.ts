import type { GameConfig } from "../entities/clicker.ts"
import { decodeClickerSave } from "./clicker-save-codec.ts"

/** What the player needs to tell two saves apart. */
export type SaveSummary = {
  savedAt: number
  started: boolean
  rebirths: number
  lifetimeCore: number
}

export function summarizeSave(raw: string | null, config: GameConfig, now: number): SaveSummary | null {
  if (!raw) return null
  const decoded = decodeClickerSave(raw, config, now)
  if (decoded.status === "empty" || decoded.status === "corrupt") return null
  const { save } = decoded
  return {
    savedAt: save.savedAt,
    started: save.settings.gameStarted,
    rebirths: save.metaState.rebirthCount,
    lifetimeCore: save.runState.lifetimeCoreEnergy,
  }
}

export type SyncAction = "upload" | "download" | "ask" | "none"

/**
 * Right after signing in. A device that never started a game just takes the cloud save;
 * an empty account just takes this device's. When both hold real progress the player
 * picks, since newer isn't always better (a fresh tab can be "newer" than a long run).
 */
export function decideInitialSync(local: SaveSummary | null, cloud: SaveSummary | null): SyncAction {
  const localReal = Boolean(local?.started)
  if (!cloud) return localReal ? "upload" : "none"
  if (!localReal) return "download"
  if (local!.savedAt === cloud.savedAt) return "none"
  return "ask"
}
