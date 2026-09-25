import assert from "node:assert/strict"
import test from "node:test"
import { pointerToOverlayCoords } from "./clicker-spark-coords.ts"

test("pointerToOverlayCoords maps client coords into overlay local space", () => {
  const rect = { left: 120, top: 80, width: 200, height: 200 }
  assert.deepEqual(pointerToOverlayCoords(150, 110, rect), { x: 30, y: 30 })
  assert.deepEqual(pointerToOverlayCoords(120, 80, rect), { x: 0, y: 0 })
})

test("pointerToOverlayCoords remaps when CSS transform scales the hit box", () => {
  // Visual box is 2× layout size (e.g. transform: scale(2))
  const rect = { left: 100, top: 50, width: 400, height: 400 }
  const layout = { width: 200, height: 200 }
  assert.deepEqual(pointerToOverlayCoords(300, 250, rect, layout), { x: 100, y: 100 })
  assert.deepEqual(pointerToOverlayCoords(100, 50, rect, layout), { x: 0, y: 0 })
})
