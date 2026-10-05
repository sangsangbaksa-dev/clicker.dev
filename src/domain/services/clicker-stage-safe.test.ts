import assert from "node:assert/strict"
import test from "node:test"
import { insetsFromObstacles, rectInside, rectsOverlap, safeRect } from "./clicker-stage-safe.ts"

const stage = { w: 1000, h: 600 }

test("a dock in the lower half claims the band below its top edge (plus the gap)", () => {
  const ins = insetsFromObstacles(stage, [{ x: 150, y: 500, w: 700, h: 80 }], { gap: 10 })
  assert.equal(ins.bottom, 110)
  assert.deepEqual(safeRect(stage, ins), { x: 0, y: 0, w: 1000, h: 490 })
})

test("tall side panels claim their side; hidden (zero-sized) overlays are ignored", () => {
  const ins = insetsFromObstacles(stage, [{ x: 700, y: 0, w: 300, h: 600 }, { x: 0, y: 0, w: 0, h: 0 }], { gap: 12, edge: 4 })
  assert.equal(ins.right, 312)
  assert.equal(ins.left, 4)
})

test("the safe area never collapses below the minimum fraction", () => {
  const ins = insetsFromObstacles(stage, [{ x: 0, y: 100, w: 1000, h: 500 }], { gap: 12 })
  assert.ok(safeRect(stage, ins).h >= 600 * 0.3 - 1e-6)
})

test("degenerate stage gives no insets; rect helpers", () => {
  assert.deepEqual(insetsFromObstacles({ w: 0, h: 10 }, []), { top: 0, right: 0, bottom: 0, left: 0 })
  assert.ok(rectInside({ x: 1, y: 1, w: 2, h: 2 }, { x: 0, y: 0, w: 10, h: 10 }))
  assert.ok(!rectsOverlap({ x: 0, y: 0, w: 5, h: 5 }, { x: 5, y: 0, w: 5, h: 5 }))
})
