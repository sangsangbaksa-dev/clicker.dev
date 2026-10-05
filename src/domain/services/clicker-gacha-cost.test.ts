import assert from "node:assert/strict"
import { test } from "node:test"

import { GACHA_PRICE_PULL_CAP, GACHA_PRICE_START, gachaBatchFactor, gachaPriceFactor } from "./clicker-gacha-cost.ts"

test("gacha price: starts well above the old flat price and rises with every pull", () => {
  assert.equal(gachaPriceFactor(0), GACHA_PRICE_START)
  assert.ok(GACHA_PRICE_START >= 5 && GACHA_PRICE_START <= 10)
  for (let n = 1; n <= GACHA_PRICE_PULL_CAP; n++) assert.ok(gachaPriceFactor(n) > gachaPriceFactor(n - 1), `pull ${n}`)
})

test("gacha price: the growth ratio itself increases (accelerating)", () => {
  let prev = gachaPriceFactor(1) / gachaPriceFactor(0)
  for (let n = 1; n < GACHA_PRICE_PULL_CAP; n++) {
    const ratio = gachaPriceFactor(n + 1) / gachaPriceFactor(n)
    assert.ok(ratio > prev, `ratio at pull ${n}`)
    prev = ratio
  }
})

test("gacha price: capped and finite for any pull count, including bad input", () => {
  const top = gachaPriceFactor(GACHA_PRICE_PULL_CAP)
  assert.ok(Number.isFinite(top) && top < 1e16)
  for (const n of [GACHA_PRICE_PULL_CAP + 1, 1e6, Number.MAX_SAFE_INTEGER, Infinity]) {
    assert.ok(Number.isFinite(gachaPriceFactor(n)), String(n))
  }
  assert.equal(gachaPriceFactor(1e9), top)
  assert.equal(gachaPriceFactor(Infinity), gachaPriceFactor(0))
  assert.equal(gachaPriceFactor(Number.NaN), gachaPriceFactor(0))
  assert.equal(gachaPriceFactor(-5), gachaPriceFactor(0))
  assert.ok(Number.isFinite(gachaBatchFactor(1e9, 10)))
  // Even a huge income (1e33 CORE/s × 600 s) times the cap stays far from overflow.
  assert.ok(Number.isFinite(1e33 * 600 * gachaBatchFactor(1e9, 10)))
})

test("gacha price: a batch is the sum of its consecutive pulls", () => {
  let sum = 0
  for (let i = 0; i < 10; i++) sum += gachaPriceFactor(7 + i)
  assert.equal(gachaBatchFactor(7, 10), sum)
  assert.equal(gachaBatchFactor(7, 0), 0)
})
