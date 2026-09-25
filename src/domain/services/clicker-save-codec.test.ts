import assert from "node:assert/strict"
import test from "node:test"
import { clickerConfig } from "../../data/clicker/catalog.ts"
import { createInitialSave } from "./clicker-engine.ts"
import {
  decodeClickerSave,
  encodeClickerSave,
  findNonFinite,
  migrateSaveData,
  readSchemaVersion,
  SAVE_MIGRATIONS,
} from "./clicker-save-codec.ts"

const config = clickerConfig
const NOW = 1_700_000_000_000

function progressedSave() {
  const save = createInitialSave(NOW, config)
  save.runState.coreEnergy = 12_345
  save.runState.lifetimeCoreEnergy = 99_999
  save.metaState.rebirthCount = 2
  save.metaState.statistics.clicks = 500
  return save
}

test("empty storage starts fresh without asking for a backup", () => {
  const decoded = decodeClickerSave(null, config, NOW)
  assert.equal(decoded.status, "empty")
  assert.equal(decoded.backup, false)
  assert.equal(decoded.save.runState.coreEnergy, 0)
})

test("a current save round-trips through encode/decode unchanged", () => {
  const save = progressedSave()
  const { json, repaired } = encodeClickerSave(save)
  assert.deepEqual(repaired, [])
  const decoded = decodeClickerSave(json, config, NOW)
  assert.equal(decoded.status, "ok")
  assert.equal(decoded.backup, false)
  assert.equal(decoded.save.runState.coreEnergy, 12_345)
  assert.equal(decoded.save.metaState.rebirthCount, 2)
})

test("unparseable JSON is reported corrupt and flagged for backup", () => {
  const decoded = decodeClickerSave('{"runState": {', config, NOW)
  assert.equal(decoded.status, "corrupt")
  assert.equal(decoded.backup, true)
  assert.equal(decoded.save.runState.coreEnergy, 0)
})

test("non-object and shapeless saves are corrupt, not silently fresh", () => {
  for (const raw of ["42", "[]", "null", '"text"', JSON.stringify({ nope: true })]) {
    const decoded = decodeClickerSave(raw, config, NOW)
    assert.equal(decoded.status, "corrupt", raw)
    assert.equal(decoded.backup, true, raw)
  }
})

test("an invalid schemaVersion is corrupt", () => {
  const save = { ...progressedSave(), schemaVersion: "one" }
  assert.equal(decodeClickerSave(JSON.stringify(save), config, NOW).status, "corrupt")
  assert.equal(readSchemaVersion({ schemaVersion: 1.5 }), null)
  assert.equal(readSchemaVersion({ schemaVersion: -1 }), null)
})

test("a NaN that went through JSON as null is repaired instead of wiping the save", () => {
  const save = progressedSave() as unknown as Record<string, Record<string, unknown>>
  save.runState!.coreEnergy = null
  save.metaState!.statistics = { ...(save.metaState!.statistics as object), crits: null }
  const decoded = decodeClickerSave(JSON.stringify(save), config, NOW)
  assert.equal(decoded.status, "repaired")
  assert.equal(decoded.backup, true)
  assert.equal(decoded.save.runState.coreEnergy, 0)
  assert.equal(decoded.save.runState.lifetimeCoreEnergy, 99_999)
  assert.equal(decoded.save.metaState.rebirthCount, 2)
  assert.equal(decoded.save.metaState.statistics.crits, 0)
  assert.equal(decoded.save.metaState.statistics.clicks, 500)
  assert.equal(findNonFinite(decoded.save), null)
})

test("encode never writes null for NaN/Infinity and the result reloads", () => {
  const save = progressedSave()
  save.runState.coreEnergy = Number.POSITIVE_INFINITY
  save.runState.lifetimeCoreEnergy = Number.NaN
  save.metaState.totalCoreEnergy = Number.NEGATIVE_INFINITY
  const { json, repaired } = encodeClickerSave(save)
  assert.equal(repaired.length, 3)
  const stored = JSON.parse(json)
  assert.equal(stored.runState.coreEnergy, Number.MAX_VALUE)
  assert.ok(!("lifetimeCoreEnergy" in stored.runState))
  const decoded = decodeClickerSave(json, config, NOW)
  assert.equal(decoded.status, "ok")
  assert.equal(decoded.save.runState.coreEnergy, Number.MAX_VALUE)
  assert.equal(decoded.save.runState.lifetimeCoreEnergy, 0)
  assert.equal(decoded.save.metaState.totalCoreEnergy, -Number.MAX_VALUE)
  assert.equal(decoded.save.metaState.rebirthCount, 2)
})

test("findNonFinite points at the bad value", () => {
  const save = progressedSave()
  assert.equal(findNonFinite(save), null)
  save.runState.producerLevels = { ...save.runState.producerLevels, drill: Number.NaN }
  assert.equal(findNonFinite(save), "save.runState.producerLevels.drill")
})

test("pre-versioned (v0) saves migrate and keep progress", () => {
  const legacy = progressedSave() as unknown as Record<string, unknown>
  delete legacy.schemaVersion
  const decoded = decodeClickerSave(JSON.stringify(legacy), config, NOW)
  assert.equal(decoded.status, "migrated")
  assert.equal(decoded.backup, true)
  assert.equal(decoded.save.schemaVersion, config.schemaVersion)
  assert.equal(decoded.save.runState.coreEnergy, 12_345)
})

test("migrations run in order and stamp each version", () => {
  const seen: number[] = []
  const migrations = {
    1: (d: Record<string, unknown>) => (seen.push(d.schemaVersion as number), { ...d, a: 1 }),
    2: (d: Record<string, unknown>) => (seen.push(d.schemaVersion as number), { ...d, b: d.a }),
  }
  const out = migrateSaveData({ schemaVersion: 1 }, 1, 3, migrations)
  assert.equal(out.error, undefined)
  assert.deepEqual(seen, [1, 2])
  assert.deepEqual(out.data, { schemaVersion: 3, a: 1, b: 1 })
})

test("a missing migration step is an error, never a silent overwrite", () => {
  const out = migrateSaveData({ schemaVersion: 1 }, 1, 3, { 1: (d) => d })
  assert.ok(out.error)
  assert.deepEqual(out.data, { schemaVersion: 1 })
})

test("every schema version below the current one has a migration", () => {
  for (let v = 0; v < config.schemaVersion; v++) assert.ok(SAVE_MIGRATIONS[v], `missing migration v${v}`)
})

test("a save from a newer build loads best-effort and is backed up", () => {
  const future = { ...progressedSave(), schemaVersion: config.schemaVersion + 1 }
  const decoded = decodeClickerSave(JSON.stringify(future), config, NOW)
  assert.equal(decoded.status, "future")
  assert.equal(decoded.backup, true)
  assert.equal(decoded.save.runState.coreEnergy, 12_345)
})
