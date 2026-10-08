import assert from "node:assert/strict"
import { test } from "node:test"

import { formatNumber, formatRate } from "./clicker-format.ts"

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

test("formatNumber never prints -0 and shows infinity explicitly", () => {
  assert.equal(formatNumber(-0.001), "0")
  assert.equal(formatNumber(0.004), "0")
  assert.equal(formatNumber(Number.POSITIVE_INFINITY), "∞")
  assert.equal(formatNumber(Number.NEGATIVE_INFINITY), "-∞")
})

test("formatRate keeps digits for tiny per-second rates (first Solar Node = 0.003/s)", () => {
  assert.equal(formatRate(0.003), "0.003")
  assert.equal(formatRate(0.00075), "0.00075")
  assert.equal(formatRate(0.000004), "4.0e-6")
  assert.equal(formatRate(0.5), "0.5")
  assert.equal(formatRate(1500), "1.5K")
  assert.equal(formatRate(0), "0")
  assert.equal(formatRate(Number.NaN), "0")
})
