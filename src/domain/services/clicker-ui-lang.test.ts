import assert from "node:assert/strict"
import { test } from "node:test"
import { normalizeClickerUiLang } from "./clicker-ui-lang.ts"

test("normalizeClickerUiLang accepts allowed tags", () => {
  assert.equal(normalizeClickerUiLang("  en  "), "en")
  assert.equal(normalizeClickerUiLang("zh-cn"), "zh-cn")
})

test("normalizeClickerUiLang maps browser tags and falls back to ko", () => {
  assert.equal(normalizeClickerUiLang("en-US"), "en")
  assert.equal(normalizeClickerUiLang("ja-JP"), "ja")
  assert.equal(normalizeClickerUiLang("zh-Hant-TW"), "zh-tw")
  assert.equal(normalizeClickerUiLang("zh-Hans"), "zh-cn")
  assert.equal(normalizeClickerUiLang("fr-FR"), "ko")
  assert.equal(normalizeClickerUiLang(null), "ko")
})
