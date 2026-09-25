import type { GameConfig, SaveData } from "../entities/clicker"
import { createInitialMeta, createInitialRun, createInitialSave, sanitizeSave } from "./clicker-engine.ts"

/**
 * How a stored save came back:
 * - empty: nothing stored yet
 * - ok: current schema, loaded as-is
 * - migrated: older schema, upgraded through SAVE_MIGRATIONS
 * - repaired: loaded, but some numbers were null/NaN/Infinity and were reset
 * - future: written by a newer build; loaded best-effort
 * - corrupt: unreadable; a fresh save was started
 */
export type SaveLoadStatus = "empty" | "ok" | "migrated" | "repaired" | "future" | "corrupt"

export type DecodedSave = {
  save: SaveData
  status: SaveLoadStatus
  /** The raw string must be backed up before autosave overwrites it. */
  backup: boolean
  reason?: string
}

type SaveRecord = Record<string, unknown>
export type SaveMigration = (data: SaveRecord) => SaveRecord

/**
 * `SAVE_MIGRATIONS[v]` upgrades a schema-v save to v+1. When bumping
 * `config.schemaVersion`, add the step for the previous version here.
 */
export const SAVE_MIGRATIONS: Readonly<Record<number, SaveMigration>> = {
  // v0 = saves written before schemaVersion existed; same shape as v1.
  0: (data) => ({ ...data, schemaVersion: 1 }),
}

function isRecord(value: unknown): value is SaveRecord {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

/** Missing schemaVersion = pre-versioned save (v0); anything else non-integer is unreadable. */
export function readSchemaVersion(data: SaveRecord): number | null {
  const v = data.schemaVersion
  if (v === undefined) return 0
  return typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null
}

export function migrateSaveData(
  data: SaveRecord,
  from: number,
  to: number,
  migrations: Readonly<Record<number, SaveMigration>> = SAVE_MIGRATIONS,
): { data: SaveRecord; error?: string } {
  let current = data
  for (let v = from; v < to; v++) {
    const step = migrations[v]
    if (!step) return { data, error: `v${v}에서 v${v + 1}로 가는 마이그레이션이 없습니다.` }
    current = { ...step(current), schemaVersion: v + 1 }
  }
  return { data: current }
}

/**
 * Reset stored numbers that are present but not finite (null from a NaN that went
 * through JSON, strings, Infinity) to the template's default. Missing keys are left
 * for sanitizeSave to fill. Returns how many values were reset.
 */
function repairNumbers(value: SaveRecord, template: SaveRecord): { value: SaveRecord; repaired: number } {
  let repaired = 0
  const next: SaveRecord = { ...value }
  for (const [key, def] of Object.entries(template)) {
    if (!(key in value)) continue
    const current = value[key]
    if (typeof def === "number") {
      if (typeof current !== "number" || !Number.isFinite(current)) {
        next[key] = def
        repaired++
      }
    } else if (isRecord(def) && isRecord(current)) {
      const inner = repairNumbers(current, def)
      next[key] = inner.value
      repaired += inner.repaired
    }
  }
  return { value: next, repaired }
}

/** Parse + validate + migrate a stored save. Never throws. */
export function decodeClickerSave(raw: string | null, config: GameConfig, now: number): DecodedSave {
  const fresh = () => createInitialSave(now, config)
  if (raw == null || raw === "") return { save: fresh(), status: "empty", backup: false }

  const corrupt = (reason: string): DecodedSave => ({ save: fresh(), status: "corrupt", backup: true, reason })

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return corrupt("JSON을 읽을 수 없습니다.")
  }
  if (!isRecord(parsed)) return corrupt("세이브 형식이 아닙니다.")

  const version = readSchemaVersion(parsed)
  if (version === null) return corrupt("schemaVersion이 올바르지 않습니다.")

  let data = parsed
  let status: SaveLoadStatus = "ok"
  let reason: string | undefined
  if (version < config.schemaVersion) {
    const migrated = migrateSaveData(parsed, version, config.schemaVersion)
    if (migrated.error) return corrupt(migrated.error)
    data = migrated.data
    status = "migrated"
    reason = `v${version} → v${config.schemaVersion}`
  } else if (version > config.schemaVersion) {
    status = "future"
    reason = `v${version} 세이브를 v${config.schemaVersion} 빌드에서 읽었습니다.`
  }

  if (!isRecord(data.runState) || !isRecord(data.metaState)) return corrupt("runState/metaState가 없습니다.")

  const initialMeta = createInitialMeta()
  const run = repairNumbers(data.runState, createInitialRun(now, initialMeta, config) as unknown as SaveRecord)
  const meta = repairNumbers(data.metaState, initialMeta as unknown as SaveRecord)
  const repaired = run.repaired + meta.repaired
  if (repaired > 0 && status === "ok") {
    status = "repaired"
    reason = `숫자 ${repaired}개를 기본값으로 되돌렸습니다.`
  }

  let save: SaveData
  try {
    save = sanitizeSave({ ...data, runState: run.value, metaState: meta.value }, config, now)
  } catch {
    return corrupt("세이브를 정리하지 못했습니다.")
  }
  if (findNonFinite(save)) return corrupt("정리 후에도 잘못된 숫자가 남았습니다.")
  return { save, status, backup: status !== "ok", reason }
}

/** Path of the first NaN/Infinity inside `value`, or null when every number is finite. */
export function findNonFinite(value: unknown, path = "save"): string | null {
  if (typeof value === "number") return Number.isFinite(value) ? null : path
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const hit = findNonFinite(value[i], `${path}[${i}]`)
      if (hit) return hit
    }
    return null
  }
  if (isRecord(value)) {
    for (const [key, inner] of Object.entries(value)) {
      const hit = findNonFinite(inner, `${path}.${key}`)
      if (hit) return hit
    }
  }
  return null
}

/**
 * JSON for storage. JSON.stringify turns NaN/±Infinity into null, which used to make
 * the next load discard the whole save; instead ±Infinity is clamped to ±MAX_VALUE and
 * NaN keys are dropped so sanitizeSave restores their defaults.
 */
export function encodeClickerSave(save: SaveData): { json: string; repaired: string[] } {
  const repaired: string[] = []
  const json = JSON.stringify(save, function (key, value) {
    if (typeof value !== "number" || Number.isFinite(value)) return value
    repaired.push(key)
    if (Number.isNaN(value)) return Array.isArray(this) ? 0 : undefined
    return value > 0 ? Number.MAX_VALUE : -Number.MAX_VALUE
  })
  return { json, repaired }
}
