import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"
import { GUARDIAN_SHADOW, GUARDIAN_SHADOW_SRC, GUARDIAN_SPRITE, GUARDIAN_TIERS, guardianFrameSrc } from "../data/clicker/guardian-sprite.ts"
import { GUARDIAN_CLIPS, allFrames } from "../domain/services/clicker-guardian-motion.ts"
import { rectInside, rectsOverlap, type Rect } from "../domain/services/clicker-stage-safe.ts"
import {
  GUARDIAN_FOOT_PX,
  GUARDIAN_HEAD_PX,
  GUARDIAN_MAX_SCREEN_HEIGHT,
  guardianSafeArea,
  type StageMetrics,
  guardianLayout,
} from "./clicker-guardian-frame.ts"

/** PC fullscreen sizes. The game header is 104 px tall; the stage is what is left below it. */
const HEADER = 104
const SCREENS: Array<[number, number]> = [[1920, 1080], [1366, 768], [2560, 1440], [1440, 900], [3440, 1440]]
/** Measured in the browser: name 24, start button 42, gap 8, the two HP bars together 85. */
const NAME_PX = 24
const START_BUTTON_PX = 42
const ROW_GAP = 8
const BARS_PX = 85
const DOCK = { w: 680, h: 77, bottomGap: 17 }

function stage(w: number, h: number): StageMetrics {
  const sh = h - HEADER
  return { size: { w, h: sh }, obstacles: [{ x: (w - DOCK.w) / 2, y: sh - DOCK.h - DOCK.bottomGap, w: DOCK.w, h: DOCK.h }] }
}

test("guardian stands on one ground line, centred, whole body inside the safe area, clear of the dock", () => {
  for (const [w, h] of SCREENS) {
    const m = stage(w, h)
    const L = guardianLayout(m, h)!
    const safe = guardianSafeArea(m)
    // relative to the column: ground = safe height - foot row
    assert.equal(L.art.groundY, safe.h - GUARDIAN_FOOT_PX, `${w}x${h}`)
    assert.ok(Math.abs(L.art.pivotX - safe.w / 2) < 1e-6)
    const abs: Rect = { x: L.art.body.x + safe.x, y: L.art.body.y + safe.y, w: L.art.body.w, h: L.art.body.h }
    assert.ok(rectInside(abs, { x: 0, y: 0, w: m.size.w, h: m.size.h }), `${w}x${h} inside stage`)
    for (const o of m.obstacles) assert.ok(!rectsOverlap(abs, o), `${w}x${h} dock`)
    assert.ok(L.art.body.y >= GUARDIAN_HEAD_PX - 1e-6, `${w}x${h} clear of the HP bars row`)
    assert.ok(L.art.groundY + GUARDIAN_FOOT_PX <= safe.h + 1e-6, "ground line stays above the dock gap")
    assert.ok(GUARDIAN_HEAD_PX >= NAME_PX + ROW_GAP + START_BUTTON_PX, "name + start button fit the head row")
    assert.ok(GUARDIAN_HEAD_PX >= BARS_PX, "the two HP bars fit the head row")
  }
})

test("it is big: the body fills most of the height left over, and the picture stays <= 115 % of the screen", () => {
  for (const [w, h] of SCREENS) {
    const L = guardianLayout(stage(w, h), h)!
    assert.ok(L.art.height <= h * GUARDIAN_MAX_SCREEN_HEIGHT + 1e-6)
    const room = guardianSafeArea(stage(w, h)).h - GUARDIAN_HEAD_PX - GUARDIAN_FOOT_PX
    assert.ok(L.art.groundY - L.art.body.y >= room * 0.9, `${w}x${h}: body ${L.art.groundY - L.art.body.y} of ${room}`)
  }
})

test("tier: tight for ordinary sizes, big once the picture outgrows the tight frames", () => {
  assert.equal(guardianLayout(stage(1920, 1080), 1080)!.tier.id, "tight")
  assert.equal(guardianLayout(stage(1366, 768), 768)!.tier.id, "tight")
  assert.equal(guardianLayout(stage(2560, 1440), 1440)!.tier.id, "big")
  assert.equal(guardianLayout(stage(3440, 1440), 1440)!.tier.id, "big")
  assert.equal(guardianLayout(stage(1366, 768), 768, 3)!.tier.id, "big")
})

test("the hit area covers the body and nothing past the safe column", () => {
  for (const [w, h] of SCREENS) {
    const L = guardianLayout(stage(w, h), h)!
    assert.ok(rectInside(L.art.body, L.hit))
    assert.ok(L.hit.y >= 0 && L.hit.y + L.hit.h <= L.column.h)
  }
})

test("degenerate stage gives null", () => {
  assert.equal(guardianLayout({ size: { w: 0, h: 0 }, obstacles: [] }, 0), null)
})

/** Reads the pixel size straight from a .webp header (VP8 / VP8L / VP8X). */
function webpSize(path: string): { w: number; h: number } {
  const b = readFileSync(path)
  assert.equal(b.toString("ascii", 0, 4), "RIFF")
  assert.equal(b.toString("ascii", 8, 12), "WEBP")
  const kind = b.toString("ascii", 12, 16)
  if (kind === "VP8 ") return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff }
  if (kind === "VP8X") return { w: b.readUIntLE(24, 3) + 1, h: b.readUIntLE(27, 3) + 1 }
  if (kind === "VP8L") {
    const bits = b.readUInt32LE(21)
    return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 }
  }
  throw new Error(`unknown webp chunk ${kind}`)
}

test("every frame exists in every tier at the size the layout assumes (re-measure data/guardian-sprite if the art is redrawn)", () => {
  for (const tier of GUARDIAN_TIERS) {
    for (const { clip, index } of allFrames()) {
      assert.ok(index < GUARDIAN_CLIPS[clip].frames)
      const file = `public${guardianFrameSrc(tier, clip, index)}`
      assert.ok(existsSync(file), file)
      const s = webpSize(file)
      assert.equal(s.w, Math.round(GUARDIAN_SPRITE.size.w * tier.scaleVsBase), file)
      assert.equal(s.h, Math.round(GUARDIAN_SPRITE.size.h * tier.scaleVsBase), file)
    }
  }
  assert.deepEqual(webpSize(`public${GUARDIAN_SHADOW_SRC}`), GUARDIAN_SHADOW.size)
  assert.ok(GUARDIAN_SPRITE.pivot.y === GUARDIAN_SPRITE.body.y + GUARDIAN_SPRITE.body.h, "body ends on the feet row")
})
