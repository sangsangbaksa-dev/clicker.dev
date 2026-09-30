import assert from "node:assert/strict"
import { test } from "node:test"

import { formatNumber } from "./clicker-format.ts"

test("formatNumber trims and suffixes", () => {
  assert.equal(formatNumber(0), "0")
  assert.equal(formatNumber(12.5), "12.5")
  assert.equal(formatNumber(1500), "1.5K")
  assert.equal(formatNumber(-2_500_000), "-2.5M")
  assert.equal(formatNumber(Number.NaN), "0")
})

test("formatNumber promotes suffix when rounding reaches 1000", () => {
  assert.equal(formatNumber(999.999), "1K")
  assert.equal(formatNumber(999_999), "1M")
  assert.equal(formatNumber(999_999_999), "1B")
})
