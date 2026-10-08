import assert from "node:assert/strict"
import test from "node:test"
import {
  CINEMATIC_NARROW_VIEWPORT_PX,
  MAX_HANDOFF_MS,
  cinematicEndFadeMs,
  pickCinematicQuality,
  resolveCinematicMedia,
  type CinematicEndReason,
} from "./clicker-cinematic.ts"

test("720p cut for narrow viewports, data-saver and slow connections; HQ otherwise or when unknown", () => {
  assert.equal(pickCinematicQuality({ viewportWidth: 1366 }), "hq")
  assert.equal(pickCinematicQuality({ viewportWidth: 1920, effectiveType: "4g", saveData: false }), "hq")
  assert.equal(pickCinematicQuality({ viewportWidth: 390 }), "mobile720")
  assert.equal(pickCinematicQuality({ viewportWidth: CINEMATIC_NARROW_VIEWPORT_PX }), "mobile720")
  assert.equal(pickCinematicQuality({ viewportWidth: CINEMATIC_NARROW_VIEWPORT_PX + 1 }), "hq")
  assert.equal(pickCinematicQuality({ viewportWidth: 1920, saveData: true }), "mobile720")
  for (const effectiveType of ["slow-2g", "2g", "3g"]) assert.equal(pickCinematicQuality({ viewportWidth: 1920, effectiveType }), "mobile720")
  assert.equal(pickCinematicQuality({ viewportWidth: Number.NaN }), "hq")
  assert.equal(pickCinematicQuality({ viewportWidth: 0 }), "hq")
})

test("only a natural end fades into the mine; skip, error, timeout and reduced motion hand off at once", () => {
  assert.equal(cinematicEndFadeMs("ended", 600, false), 600)
  for (const reason of ["skip", "error", "timeout"] as CinematicEndReason[]) assert.equal(cinematicEndFadeMs(reason, 600, false), 0, reason)
  assert.equal(cinematicEndFadeMs("ended", 600, true), 0)
})

test("fade length is sanitised: none for 0 / negative / NaN, capped, whole milliseconds", () => {
  assert.equal(cinematicEndFadeMs("ended", 0, false), 0)
  assert.equal(cinematicEndFadeMs("ended", -5, false), 0)
  assert.equal(cinematicEndFadeMs("ended", Number.NaN, false), 0)
  assert.equal(cinematicEndFadeMs("ended", 99_999, false), MAX_HANDOFF_MS)
  assert.equal(cinematicEndFadeMs("ended", 450.6, false), 451)
})

test("resolveCinematicMedia: a twin only on mobile720, a variant poster/fade apply on both, partial entries fall back", () => {
  const variants = { "/a.mp4": { mobile720: "/a_720.mp4", poster: "/a.webp", handoffMs: 500 }, "/b.mp4": { handoffMs: 300 } }
  assert.deepEqual(resolveCinematicMedia("/a.mp4", "/p.webp", variants, "hq"), { src: "/a.mp4", poster: "/a.webp", handoffMs: 500 })
  assert.deepEqual(resolveCinematicMedia("/a.mp4", "/p.webp", variants, "mobile720"), { src: "/a_720.mp4", poster: "/a.webp", handoffMs: 500 })
  assert.deepEqual(resolveCinematicMedia("/b.mp4", "/p.webp", variants, "mobile720"), { src: "/b.mp4", poster: "/p.webp", handoffMs: 300 })
  assert.deepEqual(resolveCinematicMedia("/c.mp4", "/p.webp", variants, "mobile720"), { src: "/c.mp4", poster: "/p.webp", handoffMs: 0 })
})
