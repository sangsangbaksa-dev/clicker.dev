/** Browser (or test) storage for raw clicker save JSON. Application depends on this port only. */
export type ClickerPersistencePort = {
  readRaw(): string | null
  writeRaw(value: string): void
  backupRaw(raw: string, reason: string, at: number): boolean
  clearRaw(): void
}
