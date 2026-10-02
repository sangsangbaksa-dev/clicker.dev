import assert from "node:assert/strict"
import test from "node:test"
import { clickerConfig } from "../../data/clicker/catalog.ts"
import { planBackup } from "./clicker-gmail-backup.ts"
import { createInitialSave } from "./clicker-engine.ts"
import { encodeClickerSave } from "./clicker-save-codec.ts"
import { extractSaveCodeCandidates } from "./clicker-save-extract.ts"
import { encodeSaveCode, parseSaveCode } from "./clicker-save-transfer.ts"

const NOW = 1_700_000_000_000

test("no prefix → no candidates", () => {
  assert.deepEqual(extractSaveCodeCandidates("hello world"), [])
})

test("code is found inside surrounding text and stops at the blank line", () => {
  const out = extractSaveCodeCandidates("복원 안내\n\nAURELIA1.abcDEF-_12\n\n※ 코드에는 게임 진행 데이터만")
  assert.equal(out[0], "AURELIA1.abcDEF-_12")
})

test("wrapped lines are re-joined; trailing words are tried as shorter candidates", () => {
  const out = extractSaveCodeCandidates("AURELIA1.abc\ndef\nghi\nthanks")
  assert.equal(out[0], "AURELIA1.abcdefghithanks")
  assert.ok(out.includes("AURELIA1.abcdefghi"))
})

test("a real backup mail body round-trips through extraction", () => {
  const save = createInitialSave(NOW, clickerConfig)
  save.runState.coreEnergy = 777
  const code = encodeSaveCode(encodeClickerSave(save).json)
  const plan = planBackup({ channel: "gmail", to: "", code, summary: null, now: NOW })
  const body = new URL(plan.url).searchParams.get("body") ?? ""
  assert.equal(plan.mode, "inline")
  const found = extractSaveCodeCandidates(body).map((c) => parseSaveCode(c, clickerConfig, NOW)).find((p) => p.ok)
  assert.ok(found && found.ok)
  assert.equal(found.summary.coreEnergy, 777)
})
