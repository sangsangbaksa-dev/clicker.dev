import assert from "node:assert/strict"
import test from "node:test"
import { formatNumber } from "./clicker-format.ts"

test("formatNumber renders sub-1000 values with rounding rules", () => {
  assert.equal(formatNumber(0), "0")
  assert.equal(formatNumber(42), "42")
  assert.equal(formatNumber(99.6), "99.6")
  assert.equal(formatNumber(150), "150")
  assert.equal(formatNumber(4.2), "4.2")
  assert.equal(formatNumber(4), "4")
})

test("formatNumber steps through every magnitude suffix", () => {
  assert.equal(formatNumber(1_500), "1.5K")
  assert.equal(formatNumber(2_500_000), "2.5M")
  assert.equal(formatNumber(3_000_000_000), "3B")
  assert.equal(formatNumber(4_000_000_000_000), "4T")
  assert.equal(formatNumber(5_000_000_000_000_000), "5Qa")
  assert.equal(formatNumber(6_000_000_000_000_000_000), "6Qi")
  assert.equal(formatNumber(7e21), "7Sx")
  assert.equal(formatNumber(8e24), "8Sp")
  assert.equal(formatNumber(9e27), "9Oc")
  assert.equal(formatNumber(1e30), "1No")
  assert.equal(formatNumber(1e33), "1De")
})

test("formatNumber handles negatives and non-finite input", () => {
  assert.equal(formatNumber(-2_500), "-2.5K")
  assert.equal(formatNumber(-42), "-42")
  assert.equal(formatNumber(Number.NaN), "0")
  assert.equal(formatNumber(Number.POSITIVE_INFINITY), "0")
})
