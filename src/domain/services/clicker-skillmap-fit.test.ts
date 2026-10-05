import assert from "node:assert/strict"
import { test } from "node:test"

import { clampSkillMapPan, skillMapContentBounds, skillMapInitialView } from "./clicker-skillmap-fit.ts"

test("content bounds cover every marker radius", () => {
  const box = skillMapContentBounds(
    [
      { x: 100, y: 80, r: 31 },
      { x: 40, y: 140, r: 37 },
    ],
    8,
  )
  assert.deepEqual(box, { x: 40 - 37 - 8, y: 80 - 31 - 8, w: (100 + 31) - (40 - 37) + 16, h: (140 + 37) - (80 - 31) + 16 })
})

test("content bounds ignore empty input", () => {
  assert.equal(skillMapContentBounds([]), null)
  assert.equal(skillMapContentBounds([{ x: Number.NaN, y: 0, r: 10 }]), null)
})

test("skill map opens scaled so a wide cluster fits a portrait phone", () => {
  const content = { x: 1200, y: 900, w: 460, h: 420 }
  const view = skillMapInitialView({ w: 360, h: 640 }, content, 16)
  assert.equal(view.scale, (360 - 32) / 460)
  const left = view.x + content.x * view.scale
  const right = view.x + (content.x + content.w) * view.scale
  const top = view.y + content.y * view.scale
  const bottom = view.y + (content.y + content.h) * view.scale
  assert.ok(left >= 16 - 1e-6, `left ${left}`)
  assert.ok(right <= 360 - 16 + 1e-6, `right ${right}`)
  assert.ok(top >= 16 - 1e-6, `top ${top}`)
  assert.ok(bottom <= 640 - 16 + 1e-6, `bottom ${bottom}`)
})

test("skill map opens scaled so a tall cluster fits a landscape phone", () => {
  const content = { x: 400, y: 200, w: 380, h: 520 }
  const view = skillMapInitialView({ w: 844, h: 280 }, content, 12)
  assert.equal(view.scale, (280 - 24) / 520)
  const top = view.y + content.y * view.scale
  const bottom = view.y + (content.y + content.h) * view.scale
  assert.ok(top >= 12 - 1e-6)
  assert.ok(bottom <= 280 - 12 + 1e-6)
  const left = view.x + content.x * view.scale
  const right = view.x + (content.x + content.w) * view.scale
  assert.ok(left >= 12 - 1e-6)
  assert.ok(right <= 844 - 12 + 1e-6)
})

test("skill map does not scale a cluster that already fits", () => {
  const content = { x: 10, y: 20, w: 400, h: 300 }
  const view = skillMapInitialView({ w: 1200, h: 800 }, content, 16)
  assert.equal(view.scale, 1)
  assert.equal(view.x, 1200 / 2 - (10 + 200))
  assert.equal(view.y, 800 / 2 - (20 + 150))
})

test("skill map fit rejects a degenerate view", () => {
  assert.deepEqual(skillMapInitialView({ w: 0, h: 400 }, { x: 0, y: 0, w: 100, h: 100 }), { x: 0, y: 0, scale: 1 })
  assert.deepEqual(skillMapInitialView({ w: Number.NaN, h: 400 }, { x: 0, y: 0, w: 100, h: 100 }), { x: 0, y: 0, scale: 1 })
})

test("clamp keeps a fitted board near center and a larger board reachable at both edges", () => {
  const fitted = clampSkillMapPan({ x: 9999, y: -9999 }, { w: 360, h: 500 }, { w: 200, h: 200 }, 1, 0)
  assert.equal(fitted.x, (360 - 200) / 2)
  assert.equal(fitted.y, (500 - 200) / 2)

  const big = clampSkillMapPan({ x: 9999, y: 9999 }, { w: 360, h: 280 }, { w: 800, h: 800 }, 1, 24)
  assert.equal(big.x, 24)
  assert.equal(big.y, 24)
  const far = clampSkillMapPan({ x: -9999, y: -9999 }, { w: 360, h: 280 }, { w: 800, h: 800 }, 1, 24)
  assert.equal(far.x, 360 - 800 - 24)
  assert.equal(far.y, 280 - 800 - 24)
})
