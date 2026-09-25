import { test } from "node:test"
import assert from "node:assert/strict"
import { uniqueDescriptionParts } from "./clicker-format.ts"

test("uniqueDescriptionParts drops parts the effect line already shows", () => {
  assert.equal(
    uniqueDescriptionParts("5초 · 채굴 ×1.3 · 생산 ×1.2 · 치명타 +3% · 입문용", "5초 · 채굴 ×1.3 · 생산 ×1.2 · 치명타 +3%"),
    "입문용",
  )
})

test("uniqueDescriptionParts returns empty when the description is fully redundant", () => {
  assert.equal(uniqueDescriptionParts("16초 · 채굴 ×1.75", "16초 · 채굴 ×1.75"), "")
})

test("uniqueDescriptionParts keeps a description that adds new information", () => {
  assert.equal(uniqueDescriptionParts("안정적인 초반 수신 노드.", "채굴 ×1.5"), "안정적인 초반 수신 노드.")
})
