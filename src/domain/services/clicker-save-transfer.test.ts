import assert from "node:assert/strict"
import test from "node:test"
import { clickerConfig } from "../../data/clicker/catalog.ts"
import { createInitialSave } from "./clicker-engine.ts"
import { encodeClickerSave } from "./clicker-save-codec.ts"
import { encodeSaveCode, parseSaveCode, SAVE_CODE_PREFIX } from "./clicker-save-transfer.ts"

const config = clickerConfig
const NOW = 1_700_000_000_000

function progressedJson() {
  const save = createInitialSave(NOW, config)
  save.runState.coreEnergy = 12_345
  save.metaState.totalCoreEnergy = 1_000_000
  save.metaState.rebirthCount = 3
  return encodeClickerSave(save).json
}

test("save code round-trips the stored save", () => {
  const json = progressedJson()
  const code = encodeSaveCode(json)
  assert.ok(code.startsWith(SAVE_CODE_PREFIX))
  assert.match(code.slice(SAVE_CODE_PREFIX.length), /^[A-Za-z0-9_-]+$/)
  const parsed = parseSaveCode(code, config, NOW)
  assert.ok(parsed.ok)
  assert.equal(parsed.json, json)
  assert.equal(parsed.summary.coreEnergy, 12_345)
  assert.equal(parsed.summary.rebirthCount, 3)
  assert.equal(parsed.summary.totalCoreEnergy, 1_000_000)
})

test("save code survives non-ASCII text and line breaks from chat apps", () => {
  const data = JSON.parse(progressedJson())
  data.note = "화산중 ✦ 코어"
  const json = JSON.stringify(data)
  const code = encodeSaveCode(json)
  const wrapped = `  ${code.slice(0, 20)}\n${code.slice(20, 50)} \r\n${code.slice(50)}\n`
  const parsed = parseSaveCode(wrapped, config, NOW)
  assert.ok(parsed.ok)
  assert.equal(parsed.json, json)
})

test("raw save JSON from an exported file is accepted", () => {
  const parsed = parseSaveCode(progressedJson(), config, NOW)
  assert.ok(parsed.ok)
  assert.equal(parsed.summary.rebirthCount, 3)
})

test("empty, foreign, truncated and unreadable codes are refused", () => {
  const code = encodeSaveCode(progressedJson())
  for (const input of [
    "",
    "   ",
    "hello",
    SAVE_CODE_PREFIX,
    SAVE_CODE_PREFIX + "!!!",
    code.slice(0, code.length - 7),
    encodeSaveCode("[1,2,3]"),
    encodeSaveCode('{"runState":1}'),
    "{not json",
  ]) {
    const parsed = parseSaveCode(input, config, NOW)
    assert.equal(parsed.ok, false, `accepted: ${JSON.stringify(input.slice(0, 40))}`)
    if (!parsed.ok) assert.ok(parsed.error.length > 0)
  }
})
