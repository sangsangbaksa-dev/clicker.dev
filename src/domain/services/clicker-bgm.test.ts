import assert from "node:assert/strict"
import { test } from "node:test"
import {
  bgmFadeStep,
  bgmMayTouchTrack,
  bgmOutputLevel,
  bgmPlayerGain,
  bgmTrackFadeTarget,
  bgmTracksToWarm,
  resolveBgmScene,
  worldBgmTrack,
} from "./clicker-bgm.ts"

test("worldBgmTrack maps worlds and defaults to hub", () => {
  assert.equal(worldBgmTrack("storm_spire"), "storm")
  assert.equal(worldBgmTrack(undefined), "hub")
  assert.equal(worldBgmTrack("unknown"), "hub")
})

test("bgmPlayerGain respects mute, hidden tab, and fever lift", () => {
  assert.equal(bgmPlayerGain(0.5, true, "idle", false), 0)
  assert.equal(bgmPlayerGain(0.5, false, "idle", true), 0)
  assert.equal(bgmPlayerGain(0.5, false, "fever", false), 0.6)
  assert.equal(bgmPlayerGain(0.5, false, "crisis", false), 0.375)
})

test("bgmTrackFadeTarget only opens the active scene", () => {
  assert.equal(bgmTrackFadeTarget("hub", "hub", false, 0.4), 1)
  assert.equal(bgmTrackFadeTarget("mine", "hub", false, 0.4), 0)
  assert.equal(bgmTrackFadeTarget("hub", "silent", false, 0.4), 0)
})

test("bgmFadeStep approaches target over fadeMs", () => {
  let level = 0
  for (let i = 0; i < 10; i++) level = bgmFadeStep(level, 1, 90)
  assert.ok(level > 0.8 && level < 1)
  level = bgmFadeStep(1, 0, 450)
  assert.ok(level > 0.4 && level < 0.6)
})

test("bgmOutputLevel applies master headroom", () => {
  assert.equal(bgmOutputLevel(1, 1), 0.5)
  assert.equal(bgmOutputLevel(0, 1), 0)
})

test("bgmMayTouchTrack blocks cold load and muted sessions", () => {
  assert.equal(bgmMayTouchTrack(false, false), false)
  assert.equal(bgmMayTouchTrack(true, true), false)
  assert.equal(bgmMayTouchTrack(true, false), true)
})

test("bgmTracksToWarm skips silent scenes", () => {
  assert.deepEqual(bgmTracksToWarm("silent"), [])
  assert.deepEqual(bgmTracksToWarm("mine"), ["mine"])
})

test("resolveBgmScene picks mine, chamber, silent, and world themes", () => {
  const base = {
    enteringMine: false,
    regionIntro: null,
    endingPhase: null,
    pendingRebirth: false,
    endingOpen: false,
    playSurface: "hub" as const,
    currentRegionId: "storm_spire",
  }
  assert.equal(resolveBgmScene(base), "storm")
  assert.equal(resolveBgmScene({ ...base, playSurface: "mine" }), "mine")
  assert.equal(resolveBgmScene({ ...base, pendingRebirth: true }), "chamber")
  assert.equal(resolveBgmScene({ ...base, enteringMine: true }), "silent")
  assert.equal(resolveBgmScene({ ...base, bootLoading: true }), "loading")
  assert.equal(resolveBgmScene({ ...base, bossFight: true }), "boss")
})
