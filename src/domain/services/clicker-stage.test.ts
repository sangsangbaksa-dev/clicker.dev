import assert from "node:assert/strict"
import { test } from "node:test"
import {
  drillMotes,
  frameBossScene,
  hubSurface,
  sceneCameraY,
  toWidePoint,
  weatherMotes,
  type BossSceneDef,
} from "./clicker-stage.ts"

const open = {
  inMine: false,
  isHome: false,
  atGate: false,
  hasRegion: true,
  hasBoss: false,
  hasHunt: false,
}

test("mine and home take the stage before any region activity", () => {
  assert.equal(hubSurface({ ...open, inMine: true, hasBoss: true, hasHunt: true }), "mine")
  assert.equal(hubSurface({ ...open, isHome: true }), "home")
  assert.equal(hubSurface({ ...open, hasRegion: false }), "none")
})

test("a closed gate hides the guardian, the hunt, and the drill", () => {
  assert.equal(hubSurface({ ...open, atGate: true, hasBoss: true }), "gate")
  assert.equal(hubSurface({ ...open, atGate: true, hasHunt: true }), "gate")
  assert.equal(hubSurface({ ...open, hasBoss: true }), "guardian")
  assert.equal(hubSurface({ ...open, hasHunt: true }), "hunt")
  assert.equal(hubSurface(open), "drill")
})

test("wide framing keeps height and centres the portrait", () => {
  assert.deepEqual(toWidePoint({ x: 80, y: 30 }, 0.5), { x: 65, y: 30 })
  const scene: BossSceneDef = {
    src: "/portrait.webp",
    wide: { src: "/wide.webp", scale: 0.5 },
    body: { x: 80, y: 40, w: 60, h: 50 },
    eyes: [{ x: 70, y: 20 }],
    strike: { x: 80, y: 70 },
    weather: "lava",
    tint: "255 130 40",
    attackSfx: "lavaBurst",
    hurtSfx: "bossHurt",
    sway: "heave",
  }
  const framed = frameBossScene(scene, true)
  assert.equal(framed.src, "/wide.webp")
  assert.equal(framed.body.x, 65)
  assert.equal(framed.body.w, 30)
  assert.equal(framed.body.h, 50)
  assert.equal(framed.eyes[0].x, 60)
  assert.equal(framed.strike.y, 70)
  assert.equal(frameBossScene(scene, false).src, "/portrait.webp")
})

test("a faceless guardian frames on the strike, not the top of the painting", () => {
  assert.equal(sceneCameraY(42, [], 26.2), Math.min(42, 34.2) / 100)
  assert.equal(sceneCameraY(30, [23, 23], 30), Math.min(30, 31) / 100)
})

test("later weathers get their own mote pace", () => {
  const lava = weatherMotes("lava")
  const sanctum = weatherMotes("sanctum")
  assert.equal(lava.length, 16)
  assert.equal(sanctum.length, 16)
  assert.ok(Number.parseFloat(lava[0].duration) < Number.parseFloat(sanctum[0].duration))
  assert.notEqual(lava[0].left, lava[1].left)
  assert.match(drillMotes()[0].left, /^\d+%$/)
  assert.equal(drillMotes().length, 8)
})
