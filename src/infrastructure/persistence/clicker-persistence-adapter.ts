import type { ClickerPersistencePort } from "../../application/ports/clicker-persistence.ts"
import { backupClickerRaw, clearClickerRaw, readClickerRaw, writeClickerRaw } from "./clicker-save.ts"

export const browserClickerPersistence: ClickerPersistencePort = {
  readRaw: readClickerRaw,
  writeRaw: writeClickerRaw,
  backupRaw: backupClickerRaw,
  clearRaw: clearClickerRaw,
}
