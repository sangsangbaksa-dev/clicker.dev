import assert from "node:assert/strict"
import test from "node:test"
import { groundShadowRect, groundSlot, groundedPlacement, pickTier, type GroundedSprite } from "./clicker-grounded-fit.ts"

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} !~ ${b}`)

const sprite: GroundedSprite = {
  size: { w: 1764, h: 1022 },
  pivot: { x: 882, y: 1020 },
  body: { x: 39, y: 56, w: 1688, h: 964 },
}

test("feet land on the slot's bottom edge, centred, for any slot shape", () => {
  for (const [w, h] of [[1896, 700], [600, 700], [3000, 300], [37, 91], [1200, 1200]]) {
    const slot = { x: 40, y: 120, w, h }
    const p = groundedPlacement(slot, sprite, { padTop: 0.04, padSide: 0.02 })!
    near(p.groundY, slot.y + h)
    near(p.pivotX, slot.x + w / 2)
    near(p.top + sprite.pivot.y * p.scale, p.groundY)
    near(p.left + sprite.pivot.x * p.scale, p.pivotX)
  }
})

test("body (with motion headroom) always stays inside the slot, and the fit is tight on one axis", () => {
  for (const [w, h] of [[1896, 700], [600, 700], [3000, 300], [37, 91]]) {
    const slot = { x: 0, y: 0, w, h }
    const p = groundedPlacement(slot, sprite, { padTop: 0.04, padSide: 0.02 })!
    assert.ok(p.body.x >= slot.x - 1e-6 && p.body.x + p.body.w <= slot.x + w + 1e-6, `x ${w}x${h}`)
    assert.ok(p.body.y >= slot.y - 1e-6 && p.body.y + p.body.h <= slot.y + h + 1e-6, `y ${w}x${h}`)
    const headroom = p.body.y - slot.y
    assert.ok(headroom >= 0.04 * (p.groundY - p.body.y) - 1e-6)
  }
  const wideLow = groundedPlacement({ x: 0, y: 0, w: 4000, h: 500 }, sprite)!
  near(wideLow.body.y, 0, 1e-6) // height-limited: the body's top touches the slot's top
})

test("bigger slot -> bigger sprite; caps are honoured", () => {
  const small = groundedPlacement({ x: 0, y: 0, w: 900, h: 400 }, sprite)!
  const big = groundedPlacement({ x: 0, y: 0, w: 1800, h: 800 }, sprite)!
  assert.ok(big.scale > small.scale * 1.9)
  const capped = groundedPlacement({ x: 0, y: 0, w: 5000, h: 5000 }, sprite, { maxImageHeight: 1242 })!
  near(capped.height, 1242)
  const capScale = groundedPlacement({ x: 0, y: 0, w: 5000, h: 5000 }, sprite, { maxScale: 1.5 })!
  near(capScale.scale, 1.5)
})

test("degenerate input gives null", () => {
  assert.equal(groundedPlacement({ x: 0, y: 0, w: 0, h: 100 }, sprite), null)
  assert.equal(groundedPlacement({ x: 0, y: 0, w: 100, h: Number.NaN }, sprite), null)
  assert.equal(groundedPlacement({ x: 0, y: 0, w: 100, h: 100 }, { ...sprite, body: { x: 0, y: 0, w: 0, h: 5 } }), null)
})

test("ground slot keeps head and foot rows free; ground line independent of what fills them", () => {
  const safe = { x: 12, y: 12, w: 1000, h: 800 }
  const s = groundSlot(safe, 96, 54)
  assert.deepEqual(s, { x: 12, y: 108, w: 1000, h: 650 })
  assert.equal(groundSlot(safe, 900, 900).h, 0)
})

test("pickTier: sharpest-enough resolution, big only when the shown size outgrows the base", () => {
  const tiers = [{ id: "big", scaleVsBase: 1.5 }, { id: "tight", scaleVsBase: 1 }]
  assert.equal(pickTier(tiers, 0.7).id, "tight")
  assert.equal(pickTier(tiers, 1).id, "tight")
  assert.equal(pickTier(tiers, 1.015).id, "tight")
  assert.equal(pickTier(tiers, 1.05).id, "big")
  assert.equal(pickTier(tiers, 1.2).id, "big")
  assert.equal(pickTier(tiers, 0.7, 2).id, "big")
  assert.equal(pickTier(tiers, 5).id, "big")
  assert.equal(pickTier(tiers, Number.NaN).id, "tight")
})

test("shadow box straddles the ground line and widens around the pivot", () => {
  const p = groundedPlacement({ x: 0, y: 0, w: 1000, h: 600 }, sprite)!
  const spec = { size: { w: 1205, h: 91 }, offset: { x: -602.5, y: -43 } }
  const r = groundShadowRect(p, spec)
  near(r.x + r.w / 2, p.pivotX)
  assert.ok(r.y < p.groundY && r.y + r.h > p.groundY)
  const wide = groundShadowRect(p, spec, 1.1)
  near(wide.x + wide.w / 2, p.pivotX)
  near(wide.w, r.w * 1.1)
})
