import assert from "node:assert/strict"
import test from "node:test"
import { clampSkillmapPan, fitSkillmapView, skillmapNodeRadius } from "./clicker-skillmap-fit.ts"

test("skillmapNodeRadius grows for apex tiers", () => {
  assert.ok(skillmapNodeRadius(5) > skillmapNodeRadius(2))
})

test("fitSkillmapView scales down when the board is wider than the viewport", () => {
  const cell = 84
  const nodes = [
    { col: 0, row: 0, tier: 1 },
    { col: 5, row: 0, tier: 1 },
  ]
  const { scale, panX } = fitSkillmapView({ nodes, cell, viewW: 360, viewH: 600 })
  assert.ok(scale < 1)
  const left = panX + (0 + 0.5) * cell * scale - skillmapNodeRadius(1) * scale
  const right = panX + (5 + 0.5) * cell * scale + skillmapNodeRadius(1) * scale
  assert.ok(left >= 28 - 0.5)
  assert.ok(right <= 360 - 28 + 0.5)
})

test("clampSkillmapPan keeps the scaled board inside the viewport", () => {
  const clamped = clampSkillmapPan({
    panX: -500,
    panY: -500,
    scale: 0.8,
    boardW: 400,
    boardH: 300,
    viewW: 360,
    viewH: 600,
  })
  assert.equal(clamped.panX, 12)
  assert.equal(clamped.panY, (600 - 300 * 0.8) / 2)
})
