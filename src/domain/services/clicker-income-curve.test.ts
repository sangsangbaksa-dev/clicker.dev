import assert from "node:assert/strict"
import test from "node:test"
import { incomePerMinute, summarizeCurve, windowedMaxJump, type CurveSample } from "./clicker-income-curve.ts"

/** Lifetime counter for a rate that doubles every minute for `climb` minutes, then stays flat. */
function curve(minutes: number, rateAt: (minute: number) => number): CurveSample[] {
  const out: CurveSample[] = [{ t: 0, life: 0 }]
  let life = 0
  for (let m = 0; m < minutes; m++) {
    life += rateAt(m) * 60
    out.push({ t: (m + 1) * 60, life })
  }
  return out
}

test("incomePerMinute recovers the per-minute rate, also from uneven samples", () => {
  const even = incomePerMinute(curve(5, (m) => 10 * (m + 1)))
  assert.deepEqual(even.map((r) => Math.round(r)), [10, 20, 30, 40, 50])
  const uneven: CurveSample[] = [{ t: 0, life: 0 }, { t: 90, life: 900 }, { t: 200, life: 2000 }]
  assert.deepEqual(incomePerMinute(uneven).map((r) => Math.round(r)), [10, 10, 10])
})

test("a doubling climb followed by a flat run is reported as jumps then plateau", () => {
  const s = summarizeCurve(curve(60, (m) => (m < 12 ? 2 ** m : 2 ** 12)), { skipMinutes: 1, jumpAt: 2.01 })
  assert.ok(Math.abs(s.maxJump - 2) < 1e-6)
  assert.equal(s.jumpMinutes, 0, "exactly ×2 is not above the ×2 threshold")
  assert.ok(s.plateauMinutes >= 25, `plateau ${s.plateauMinutes}`)
  assert.ok(s.plateauShare > 0.4)
})

test("a ×50 cliff is flagged and a smooth ×1.3 climb is not", () => {
  const cliff = summarizeCurve(curve(30, (m) => (m < 10 ? 1 : 50)), { skipMinutes: 1 })
  assert.equal(cliff.jumpMinutes, 1)
  assert.ok(Math.abs(cliff.maxJump - 50) < 1e-6)
  const smooth = summarizeCurve(curve(60, (m) => 1.3 ** m), { skipMinutes: 1 })
  assert.equal(smooth.jumpMinutes, 0)
  assert.equal(smooth.plateauMinutes, 0)
})

test("short or empty curves are harmless", () => {
  assert.deepEqual(incomePerMinute([]), [])
  const s = summarizeCurve([{ t: 0, life: 0 }, { t: 30, life: 5 }])
  assert.equal(s.perMinute.length, 0)
  assert.equal(s.maxJump, 0)
})

test("windowed jump ignores one noisy minute but sees a real step", () => {
  const noisy = Array.from({ length: 30 }, (_, m) => (m % 2 ? 1000 : 100) * 1.1 ** m)
  assert.ok(windowedMaxJump(noisy, 4).ratio < 1.6, "alternating minutes average out")
  const steady = Array.from({ length: 30 }, (_, m) => 2 ** m)
  assert.ok(Math.abs(windowedMaxJump(steady, 3).ratio - 2) < 1e-9, "steady doubling reads ×2")
  const step = Array.from({ length: 30 }, (_, m) => (m < 15 ? 10 : 100))
  const w = windowedMaxJump(step, 3)
  assert.ok(w.ratio > 2.5 && w.minute >= 13 && w.minute <= 16, `step found at m${w.minute} ×${w.ratio}`)
  assert.equal(windowedMaxJump([1, 2, 3], 3).ratio, 0)
})
