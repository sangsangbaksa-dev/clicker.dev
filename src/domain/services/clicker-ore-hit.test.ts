import assert from "node:assert/strict"
import test from "node:test"
import { buildAlphaMask, mapPointToImage, maskHit, oreHitTest } from "./clicker-ore-hit.ts"

/** 4×4 image: a plus-shaped ore (alpha 255) on a transparent field, one faint pixel (alpha 16). */
function plus() {
  const w = 4
  const h = 4
  const rgba = new Uint8ClampedArray(w * h * 4)
  const on = [[1, 0], [1, 1], [1, 2], [0, 1], [2, 1], [1, 3]]
  for (const [x, y] of on) rgba[(y * w + x) * 4 + 3] = 255
  rgba[(3 * w + 3) * 4 + 3] = 16
  rgba[(0 * w + 3) * 4 + 3] = 17
  return buildAlphaMask(rgba, w, h)
}

test("mask uses alpha > 16", () => {
  const m = plus()
  assert.equal(maskHit(m, 3.5, 3.5), false)
  assert.equal(maskHit(m, 3.5, 0.5), true)
  assert.equal(maskHit(m, 1.5, 1.5), true)
  assert.equal(maskHit(m, 0.5, 0.5), false)
})

test("outside the image never hits", () => {
  const m = plus()
  assert.equal(maskHit(m, -0.1, 1), false)
  assert.equal(maskHit(m, 1, 4), false)
  assert.equal(maskHit(m, 10, 10), false)
})

test("fill: scaled rect maps click to image pixels", () => {
  const m = plus()
  const rect = { left: 100, top: 50, width: 400, height: 400 }
  assert.equal(oreHitTest(m, { x: 250, y: 150 }, rect), true)
  assert.equal(oreHitTest(m, { x: 150, y: 100 }, rect), false)
  assert.equal(oreHitTest(m, { x: 50, y: 150 }, rect), false)
})

test("contain: letterbox bars do not count, image is centred", () => {
  const m = plus()
  const rect = { left: 0, top: 0, width: 800, height: 400 }
  assert.equal(oreHitTest(m, { x: 100, y: 200 }, rect, "contain"), false)
  assert.equal(oreHitTest(m, { x: 300, y: 150 }, rect, "contain"), true)
  const p = mapPointToImage({ x: 200, y: 0 }, rect, m, "contain")
  assert.deepEqual(p, { x: 0, y: 0 })
})

test("cover: image overflows the rect, crop is centred", () => {
  const m = plus()
  const rect = { left: 0, top: 0, width: 200, height: 400 }
  const p = mapPointToImage({ x: 0, y: 0 }, rect, m, "cover")
  assert.deepEqual(p, { x: 1, y: 0 })
})

test("extra transform scale about the centre is undone", () => {
  const m = plus()
  const rect = { left: 0, top: 0, width: 400, height: 400 }
  const p = mapPointToImage({ x: 400, y: 200 }, rect, m, "fill", 2)
  assert.deepEqual(p, { x: 3, y: 2 })
})

test("empty rect never hits", () => {
  assert.equal(oreHitTest(plus(), { x: 0, y: 0 }, { left: 0, top: 0, width: 0, height: 0 }), false)
})
