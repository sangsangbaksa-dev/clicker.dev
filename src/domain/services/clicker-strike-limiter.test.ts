import assert from "node:assert/strict"
import test from "node:test"
import { allowStrike, MINE_MAX_CPS } from "./clicker-strike-limiter.ts"

test("cap is 11 strikes per second", () => {
  assert.equal(MINE_MAX_CPS, 11)
})

test("strikes beyond the cap inside one second are dropped", () => {
  const w: number[] = []
  let landed = 0
  for (let i = 0; i < 30; i++) if (allowStrike(w, 1000 + i * 10)) landed++
  assert.equal(landed, 11)
})

test("the window slides: a new strike lands once the oldest is a second old", () => {
  const w: number[] = []
  for (let i = 0; i < 11; i++) assert.equal(allowStrike(w, i), true)
  assert.equal(allowStrike(w, 500), false)
  assert.equal(allowStrike(w, 1000), true)
  assert.equal(allowStrike(w, 1000), false)
})

test("a dropped strike is not recorded", () => {
  const w: number[] = []
  for (let i = 0; i < 11; i++) allowStrike(w, i)
  allowStrike(w, 600)
  assert.equal(w.length, 11)
})

test("sustained 5 cps never hits the cap", () => {
  const w: number[] = []
  for (let i = 0; i < 50; i++) assert.equal(allowStrike(w, i * 200), true)
})
