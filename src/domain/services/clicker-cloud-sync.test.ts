import assert from "node:assert/strict"
import test from "node:test"
import { clickerConfig } from "../../data/clicker/catalog.ts"
import { createInitialSave } from "./clicker-engine.ts"
import { encodeClickerSave } from "./clicker-save-codec.ts"
import { decideInitialSync, summarizeSave, type SaveSummary } from "./clicker-cloud-sync.ts"

const summary = (over: Partial<SaveSummary>): SaveSummary => ({
  savedAt: 1000,
  started: true,
  rebirths: 0,
  lifetimeCore: 10,
  ...over,
})

test("summarizeSave reads a real encoded save and rejects junk", () => {
  const save = { ...createInitialSave(5000, clickerConfig), savedAt: 5000 }
  const raw = encodeClickerSave(save).json
  const s = summarizeSave(raw, clickerConfig, 6000)
  assert.equal(s?.savedAt, 5000)
  assert.equal(s?.started, save.settings.gameStarted)
  assert.equal(summarizeSave("{not json", clickerConfig, 6000), null)
  assert.equal(summarizeSave(null, clickerConfig, 6000), null)
})

test("initial sync: empty sides never prompt", () => {
  assert.equal(decideInitialSync(null, null), "none")
  assert.equal(decideInitialSync(summary({}), null), "upload")
  assert.equal(decideInitialSync(summary({ started: false }), null), "none")
  assert.equal(decideInitialSync(null, summary({})), "download")
  assert.equal(decideInitialSync(summary({ started: false, savedAt: 9999 }), summary({})), "download")
})

test("initial sync: two real, different saves ask the player", () => {
  assert.equal(decideInitialSync(summary({ savedAt: 1 }), summary({ savedAt: 2 })), "ask")
  assert.equal(decideInitialSync(summary({ savedAt: 3 }), summary({ savedAt: 3 })), "none")
})
