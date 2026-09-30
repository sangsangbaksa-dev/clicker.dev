import type { ClickerPersistencePort } from "@/application/ports/clicker-persistence"
import { backupClickerRaw, clearClickerRaw, readClickerRaw, writeClickerRaw } from "@/infrastructure/persistence/clicker-save"

export const browserClickerPersistence: ClickerPersistencePort = {
  readRaw: readClickerRaw,
  writeRaw: writeClickerRaw,
  backupRaw: backupClickerRaw,
  clearRaw: clearClickerRaw,
}
