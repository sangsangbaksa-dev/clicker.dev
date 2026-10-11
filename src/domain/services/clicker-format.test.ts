import assert from "node:assert/strict"
import { test } from "node:test"

import { formatNumber, withParticle } from "./clicker-format.ts"

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

test("formatNumber rolls the top suffix over into scientific notation", () => {
  assert.equal(formatNumber(999.999e33), "1e36")
  assert.equal(formatNumber(-999.999e33), "-1e36")
})

test("withParticle follows the last sound of digits and Latin names", () => {
  assert.equal(withParticle("볼트", "이가"), "볼트가")
  assert.equal(withParticle("Mine", "은는"), "Mine은")
  assert.equal(withParticle("Vial", "으로"), "Vial로")
  assert.equal(withParticle("Mk1", "을를"), "Mk1을")
  assert.equal(withParticle("Mk2", "을를"), "Mk2를")
  assert.equal(withParticle("Mk3", "으로"), "Mk3으로")
  assert.equal(withParticle("", "이가"), "가")
})
