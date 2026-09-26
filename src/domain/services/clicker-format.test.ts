import assert from "node:assert/strict"
import test from "node:test"
import { formatNumber } from "./clicker-format.ts"

test("formatNumber keeps small values readable", () => {
  assert.equal(formatNumber(0), "0")
  assert.equal(formatNumber(42), "42")
  assert.equal(formatNumber(12.5), "12.5")
  assert.equal(formatNumber(999), "999")
})

test("formatNumber scales through every suffix instead of piling digits onto Qa", () => {
  assert.equal(formatNumber(1_500), "1.5K")
  assert.equal(formatNumber(2e6), "2M")
  assert.equal(formatNumber(3.25e9), "3.25B")
  assert.equal(formatNumber(4e12), "4T")
  assert.equal(formatNumber(5e15), "5Qa")
  assert.equal(formatNumber(8.76e21), "8.76Sx")
  assert.equal(formatNumber(1e18), "1Qi")
  assert.equal(formatNumber(1.2e33), "1.2Dc")
})

test("formatNumber falls back to scientific notation past the last suffix", () => {
  assert.equal(formatNumber(1.5e40), "1.50e40")
  assert.equal(formatNumber(-2e6), "-2M")
  assert.equal(formatNumber(Number.POSITIVE_INFINITY), "0")
})
