import assert from "node:assert/strict"
import test from "node:test"
import {
  clipDurationMs,
  easeOutBack,
  easeOutCubic,
  sampleClip,
  sampleClipStepped,
  smoothstep,
  type Clip,
} from "./clicker-sprite-clock.ts"

const idle: Clip = { frames: 6, fps: 6, loop: true }
const hit: Clip = { frames: 3, fps: 12, loop: false }
const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} !~ ${b}`)

test("durations", () => {
  assert.equal(clipDurationMs(idle), 1000)
  assert.equal(clipDurationMs(hit), 250)
  assert.equal(clipDurationMs({ frames: 6, fps: 0, loop: false }), 0)
})

test("loop: keyframes land on their time, the last frame blends into the first", () => {
  assert.deepEqual(sampleClip(idle, 0), { a: 0, b: 1, mix: 0, done: false })
  const mid = sampleClip(idle, 1000 / 6 / 2)
  assert.equal(mid.a, 0)
  assert.equal(mid.b, 1)
  near(mid.mix, 0.5)
  const wrap = sampleClip(idle, 5.5 * (1000 / 6))
  assert.equal(wrap.a, 5)
  assert.equal(wrap.b, 0)
  assert.equal(sampleClip(idle, 1000).a, 0)
  assert.equal(sampleClip(idle, 12345).a, sampleClip(idle, 12345 % 1000).a)
})

test("one-shot: holds the last frame and reports done only after the full duration", () => {
  assert.equal(sampleClip(hit, 0).done, false)
  const late = sampleClip(hit, 2 * (1000 / 12) + 1)
  assert.equal(late.a, 2)
  assert.equal(late.b, 2)
  assert.equal(late.mix, 0)
  assert.equal(late.done, false)
  assert.equal(sampleClip(hit, 250).done, true)
  assert.equal(sampleClip(hit, 9999).a, 2)
})

test("mix is eased: slow at the ends, monotonic, exact at 0 / 1", () => {
  let prev = -1
  for (let k = 0; k <= 20; k++) {
    const m = sampleClip(idle, (k / 20) * (1000 / 6) - 1e-9 * (k === 20 ? 1 : 0)).mix
    assert.ok(m >= prev - 1e-9)
    prev = m
  }
  assert.ok(sampleClip(idle, 0.1 * (1000 / 6)).mix < 0.1)
  near(smoothstep(0.5), 0.5)
  near(smoothstep(-3), 0)
  near(smoothstep(4), 1)
})

test("bad input is safe", () => {
  assert.deepEqual(sampleClip(idle, Number.NaN), sampleClip(idle, 0))
  assert.deepEqual(sampleClip(idle, -50), sampleClip(idle, 0))
  assert.equal(sampleClip({ frames: 1, fps: 6, loop: true }, 500).b, 0)
})

test("stepped sampling never blends", () => {
  for (const t of [0, 40, 100, 160, 700, 990]) assert.equal(sampleClipStepped(idle, t).mix, 0)
  assert.equal(sampleClipStepped(idle, 400).a, 2)
})

test("easings", () => {
  near(easeOutCubic(0), 0)
  near(easeOutCubic(1), 1)
  assert.ok(easeOutCubic(0.3) > 0.3)
  near(easeOutBack(0), 0, 1e-9)
  near(easeOutBack(1), 1, 1e-9)
  assert.ok(Math.max(...[0.6, 0.7, 0.8].map((x) => easeOutBack(x))) > 1)
})
