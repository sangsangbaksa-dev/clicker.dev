import assert from "node:assert/strict"
import { existsSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { MINE_ORE_PLATE, MineArt } from "../../data/clicker/mine-assets.ts"
import {
  MIN_ORE_SHRINK,
  clampOreShrink,
  coverFit,
  isInsideRect,
  layoutOrePlate,
  type OreFit,
  type OreShadow,
  type OrePlateSource,
} from "./clicker-ore-plate.ts"

// The shipped data (data/clicker/mine-assets.ts); the literals in the tests below pin the measured values.
const SOURCE: OrePlateSource = MINE_ORE_PLATE
const FIT: OreFit = MINE_ORE_PLATE.fit
const SHADOW: OreShadow = MINE_ORE_PLATE.shadow
const VIEWS = [
  { name: "1280x720", w: 1280, h: 720 },
  { name: "1366x768", w: 1366, h: 768 },
  { name: "390x844 (phone)", w: 390, h: 844 },
]
const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`)

test("shrink is clamped to (MIN, 1]: never an upscale, junk means no shrink", () => {
  assert.equal(clampOreShrink(0.48), 0.48)
  assert.equal(clampOreShrink(1), 1)
  assert.equal(clampOreShrink(1.7), 1)
  assert.equal(clampOreShrink(0.01), MIN_ORE_SHRINK)
  for (const bad of [0, -0.5, Number.NaN, Number.POSITIVE_INFINITY]) assert.equal(clampOreShrink(bad), 1, String(bad))
})

test("the shipped fit only shrinks: rendered box is never larger than the baked crystal, in any viewport", () => {
  for (const v of VIEWS) {
    const l = layoutOrePlate(v.w, v.h, SOURCE, FIT, SHADOW)
    assert.ok(l.shrink <= 1 && l.shrink > 0, v.name)
    assert.ok(l.rendered.width <= l.legacy.width, v.name)
    assert.ok(l.rendered.height <= l.legacy.height, v.name)
    near(l.rendered.width / l.legacy.width, 0.48)
    near(l.rendered.height / l.legacy.height, 0.48)
  }
  // An upscaling request is clamped back to the baked size (centre still honoured).
  const up = layoutOrePlate(1280, 720, SOURCE, { scale: 2, centerX: 647, centerY: 370 }, SHADOW)
  assert.deepEqual(up.rendered, up.legacy)
})

test("hit area equals the rendered box (same numbers), and the shrunk box sits inside the baked crystal", () => {
  for (const v of VIEWS) {
    const l = layoutOrePlate(v.w, v.h, SOURCE, FIT, SHADOW)
    assert.deepEqual(l.hit, l.rendered, v.name)
    assert.notEqual(l.hit, l.rendered, "a copy, not an alias")
    assert.ok(l.rendered.left >= l.legacy.left && l.rendered.top >= l.legacy.top, v.name)
    assert.ok(l.rendered.left + l.rendered.width <= l.legacy.left + l.legacy.width, v.name)
    assert.ok(l.rendered.top + l.rendered.height <= l.legacy.top + l.legacy.height, v.name)
    const cx = l.rendered.left + l.rendered.width / 2
    const cy = l.rendered.top + l.rendered.height / 2
    assert.ok(isInsideRect(l.hit, cx, cy), "centre is hittable")
    assert.ok(!isInsideRect(l.hit, l.hit.left - 1, cy) && !isInsideRect(l.hit, cx, l.hit.top + l.hit.height + 1), "just outside is not")
    // The old (big) edge area is no longer a hit.
    assert.ok(!isInsideRect(l.hit, l.legacy.left + 2, l.legacy.top + 2), v.name)
  }
})

test("1280x720: the plate is drawn 1:1 and the box lands on the measured video position", () => {
  const l = layoutOrePlate(1280, 720, SOURCE, FIT, SHADOW)
  assert.deepEqual(l.cover, { scale: 1, left: 0, top: 0 })
  near(l.legacy.left, 488)
  near(l.rendered.width, 318 * 0.48)
  near(l.rendered.height, 324 * 0.48)
  near(l.rendered.left + l.rendered.width / 2, 643)
  near(l.rendered.top + l.rendered.height / 2, 354.5)
})

test("responsive: the whole layout follows the cover fit (1366x768 scales, 390x844 crops the sides)", () => {
  const wide = layoutOrePlate(1366, 768, SOURCE, FIT, SHADOW)
  near(wide.cover.scale, 1366 / 1280)
  near(wide.rendered.left + wide.rendered.width / 2, (643 * 1366) / 1280)
  // 1366x768 is a hair wider than 16:9, so width decides the cover scale and the plate is cropped 0.2 px top/bottom.
  near(wide.cover.top, (768 - 720 * wide.cover.scale) / 2)
  near(wide.rendered.top + wide.rendered.height / 2, wide.cover.top + 354.5 * wide.cover.scale)
  near(wide.rendered.width, 318 * 0.48 * (1366 / 1280))

  const phone = layoutOrePlate(390, 844, SOURCE, FIT, SHADOW)
  const k = 844 / 720
  near(phone.cover.scale, k)
  near(phone.cover.left, (390 - 1280 * k) / 2) // sides cropped
  near(phone.cover.top, 0)
  near(phone.rendered.left + phone.rendered.width / 2, phone.cover.left + 643 * k)
  near(phone.rendered.top + phone.rendered.height / 2, 354.5 * k)
  // The crystal stays on screen and tappable at phone width (>= 44 px touch target).
  assert.ok(phone.rendered.left >= 0 && phone.rendered.left + phone.rendered.width <= 390)
  assert.ok(phone.hit.width >= 44 && phone.hit.height >= 44, `${phone.hit.width}x${phone.hit.height}`)
  // Same ratio of ore width to plate width in every view.
  for (const v of VIEWS) {
    const l = layoutOrePlate(v.w, v.h, SOURCE, FIT, SHADOW)
    near(l.rendered.width / (SOURCE.width * l.cover.scale), (318 * 0.48) / 1280)
  }
})

test("art crop: the plate is scaled with the ore, so the crop shows exactly the baked crystal's pixels in the box", () => {
  for (const v of VIEWS) {
    const l = layoutOrePlate(v.w, v.h, SOURCE, FIT, SHADOW)
    near(l.art.width, SOURCE.width * l.cover.scale * l.shrink)
    near(l.art.height, SOURCE.height * l.cover.scale * l.shrink)
    // Plate-left of the crystal maps to the box's left edge: x_art + ore.x * (art scale) == 0.
    near(l.art.x + SOURCE.ore.x * (l.art.width / SOURCE.width), 0)
    near(l.art.y + SOURCE.ore.y * (l.art.height / SOURCE.height), 0)
    // The cropped region (ore.w x ore.h of the plate) fills the box exactly.
    near(SOURCE.ore.w * (l.art.width / SOURCE.width), l.rendered.width)
    near(SOURCE.ore.h * (l.art.height / SOURCE.height), l.rendered.height)
  }
})

test("ground shadow: derived from the SHRUNK ore box (fractions), sits under the base, scales with the ore", () => {
  for (const v of VIEWS) {
    const l = layoutOrePlate(v.w, v.h, SOURCE, FIT, SHADOW)
    const r = l.shadow.rect
    const b = l.rendered
    near(r.width, 2 * SHADOW.rx * b.width)
    near(r.height, 2 * SHADOW.ry * b.height)
    near(r.left + r.width / 2, b.left + SHADOW.cx * b.width)
    near(r.top + r.height / 2, b.top + SHADOW.cy * b.height)
    near(l.shadow.alpha, SHADOW.alpha)
    // Under the crystal's base (below the box centre), roughly as wide as the ore, much flatter than tall.
    assert.ok(r.top + r.height / 2 > b.top + b.height / 2, v.name)
    assert.ok(r.width >= b.width * 0.8 && r.width <= b.width * 1.4, v.name)
    assert.ok(r.height <= r.width * 0.3, v.name)
    // Far smaller than the old baked crystal's box: a small shadow, not a pool across the room.
    assert.ok(r.width < l.legacy.width && r.height < l.legacy.height / 3, v.name)
    // Follows the ore: the same shrink-independent fractions, so a smaller ore means a smaller shadow.
    const smaller = layoutOrePlate(v.w, v.h, SOURCE, { ...FIT, scale: 0.3 }, SHADOW)
    near(smaller.shadow.rect.width / l.shadow.rect.width, 0.3 / 0.48)
    near(smaller.shadow.rect.height / l.shadow.rect.height, 0.3 / 0.48)
  }
  // 1280x720 grid: numbers pinned (centre (643 - 0.02 x 152.64, ...) etc.).
  const l = layoutOrePlate(1280, 720, SOURCE, FIT, SHADOW)
  near(l.shadow.rect.width, 2 * 0.55 * 152.64)
  near(l.shadow.rect.left + l.shadow.rect.width / 2, 643 - 152.64 / 2 + 0.48 * 152.64)
  near(l.shadow.rect.top + l.shadow.rect.height / 2, 354.5 - 155.52 / 2 + 0.93 * 155.52)
})

test("the cover-up ellipse is gone: no patch in the layout or in the data", () => {
  const l = layoutOrePlate(1280, 720, SOURCE, FIT, SHADOW)
  assert.equal("patch" in l, false)
  assert.equal("patch" in MINE_ORE_PLATE, false)
})

test("invalid shadow input means no shadow (never NaN, never a huge shape)", () => {
  for (const bad of [
    { ...SHADOW, rx: 0 },
    { ...SHADOW, ry: -1 },
    { ...SHADOW, rx: Number.NaN },
    { ...SHADOW, cx: Number.POSITIVE_INFINITY },
    { ...SHADOW, alpha: Number.NaN },
  ]) {
    const l = layoutOrePlate(1280, 720, SOURCE, FIT, bad)
    assert.equal(l.shadow.alpha, 0)
    assert.deepEqual(l.shadow.rect, { left: 0, top: 0, width: 0, height: 0 })
  }
  assert.equal(layoutOrePlate(1280, 720, SOURCE, FIT, { ...SHADOW, alpha: 7 }).shadow.alpha, 1)
  assert.equal(layoutOrePlate(1280, 720, SOURCE, FIT, { ...SHADOW, alpha: -2 }).shadow.alpha, 0)
})

test("junk viewport input never produces NaN boxes", () => {
  for (const [w, h] of [[0, 0], [-1, 700], [Number.NaN, 720], [1280, Number.POSITIVE_INFINITY]]) {
    const l = layoutOrePlate(w, h, SOURCE, FIT, SHADOW)
    for (const r of [l.legacy, l.rendered, l.hit, l.shadow.rect]) assert.deepEqual(Object.values(r).map((n) => Number.isFinite(n)), [true, true, true, true])
    assert.equal(l.hit.width, 0)
  }
  assert.deepEqual(coverFit(100, 100, 0, 0), { scale: 0, left: 0, top: 0 })
})

test("shipped data: measured fit (x0.48 at 643, 354.5), shrink only, clean plate + original crop source both ship", () => {
  const pub = join(import.meta.dirname, "../../../public")
  assert.deepEqual(MINE_ORE_PLATE.ore, { x: 488, y: 208, w: 318, h: 324 }, "baked crystal bounds (in the ORIGINAL plate) unchanged")
  assert.deepEqual(MINE_ORE_PLATE.fit, { scale: 0.48, centerX: 643, centerY: 354.5 })
  assert.ok(MINE_ORE_PLATE.fit.scale <= 1 && MINE_ORE_PLATE.fit.scale >= MIN_ORE_SHRINK)
  assert.ok(existsSync(join(pub, MINE_ORE_PLATE.src)), "original plate ships (source of the crystal crop)")
  assert.ok(existsSync(join(pub, MINE_ORE_PLATE.clean)), "clean plate ships (copied by apply-assets.sh)")
  assert.notEqual(MINE_ORE_PLATE.clean, MINE_ORE_PLATE.src)
  // Both are 1920x1080 webp like before (same aspect as width x height).
  for (const f of [MINE_ORE_PLATE.src, MINE_ORE_PLATE.clean]) {
    const b = readFileSync(join(pub, f))
    assert.equal(b.toString("ascii", 0, 4), "RIFF", f)
    assert.equal(b.toString("ascii", 8, 12), "WEBP", f)
    const size = webpSize(b)
    assert.deepEqual(size, { w: 1920, h: 1080 }, f)
    assert.equal(size.w / size.h, MINE_ORE_PLATE.width / MINE_ORE_PLATE.height, f)
  }
  assert.ok(statSync(join(pub, MINE_ORE_PLATE.clean)).size < 400_000, "clean plate stays in the existing plate's size class")
  assert.equal(MineArt.orePlate, MINE_ORE_PLATE.clean, "background layer = clean plate")
  assert.equal(MineArt.orePlateCrystal, MINE_ORE_PLATE.src, "ore crop = original plate")
  // Shadow: valid fractions, dark cyan core colour (blue/green above red), soft (alpha well below 1).
  const { rgb, alpha } = MINE_ORE_PLATE.shadow
  assert.ok(rgb.length === 3 && rgb.every((c) => c >= 0 && c <= 60) && rgb[2] > rgb[0] && rgb[1] > rgb[0], `rgb ${rgb}`)
  assert.ok(alpha > 0 && alpha <= 0.7, `alpha ${alpha}`)
})

/** Pixel size of a lossy (VP8) webp from its header chunk. */
function webpSize(b: Buffer): { w: number; h: number } {
  assert.equal(b.toString("ascii", 12, 16), "VP8 ")
  return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff }
}
