import assert from "node:assert/strict"
import test from "node:test"
import { clickerConfig as config } from "../../data/clicker/catalog.ts"
import { applyRebirth, createInitialSave, sanitizeSave } from "./clicker-engine.ts"
import {
  DAWN_GOAL_GROWTH,
  advancePostgame,
  canPlayAfterCompletion,
  continueAfterEnding,
  getDawnDepth,
  getDawnShards,
  postgameCompleted,
  postgameDepthGoal,
  showsCompletionScreen,
} from "./clicker-postgame.ts"

const NOW = 1_000_000
const completedMeta = () => ({ ...createInitialSave(NOW, config).metaState, gameCompleted: true, completedAt: NOW, bossDefeated: true, totalCoreEnergy: 1e12 })

test("dawn mine stays closed before the ending", () => {
  const meta = createInitialSave(NOW, config).metaState
  assert.ok(continueAfterEnding(meta, NOW).error)
  assert.equal(getDawnDepth(meta), 0)
  assert.equal(postgameCompleted(meta), false)
  assert.ok(canPlayAfterCompletion(meta))
  assert.equal(showsCompletionScreen(meta), false)
  assert.equal(advancePostgame(meta, 1e30).gainedDepths, 0)
})

test("completed without continuing: frozen completion screen", () => {
  const meta = completedMeta()
  assert.ok(postgameCompleted(meta))
  assert.equal(canPlayAfterCompletion(meta), false)
  assert.ok(showsCompletionScreen(meta))
})

test("continue opens the dawn mine once and lets play resume", () => {
  const opened = continueAfterEnding(completedMeta(), NOW).meta
  assert.ok(canPlayAfterCompletion(opened))
  assert.equal(showsCompletionScreen(opened), false)
  assert.equal(getDawnDepth(opened), 0)
  assert.equal(continueAfterEnding(opened, NOW + 5).meta, opened, "second press is a no-op")
})

test("depth goals grow and depth only moves forward", () => {
  const base = 1e10
  assert.ok(Math.abs(postgameDepthGoal(3, base) / postgameDepthGoal(2, base) - DAWN_GOAL_GROWTH) < 1e-9)
  let meta = continueAfterEnding(completedMeta(), NOW).meta
  const goal0 = postgameDepthGoal(0, meta.postgame!.base)
  meta = advancePostgame(meta, goal0 * 0.5).meta
  assert.equal(getDawnDepth(meta), 0)
  const step = advancePostgame(meta, goal0 * 0.5 + postgameDepthGoal(1, meta.postgame!.base))
  assert.equal(step.gainedDepths, 2)
  assert.equal(getDawnDepth(step.meta), 2)
  assert.equal(getDawnShards(step.meta), 2)
  for (const bad of [-5, Number.NaN, Infinity, 0]) assert.equal(advancePostgame(step.meta, bad).gainedDepths, 0)
})

test("rebirth stays closed in the dawn mine", () => {
  const save = createInitialSave(NOW, config)
  const meta = continueAfterEnding(completedMeta(), NOW).meta
  assert.ok(applyRebirth(save.runState, meta, config, config.transcendence[0].id, NOW).error)
})

test("saves: old saves load without dawn mine; dawn mine round-trips; junk is dropped", () => {
  const legacy = { ...createInitialSave(NOW, config), metaState: completedMeta() }
  assert.equal(sanitizeSave(legacy, config, NOW).metaState.postgame, undefined)
  const meta = advancePostgame(continueAfterEnding(completedMeta(), NOW).meta, 1e13).meta
  const loaded = sanitizeSave({ ...legacy, metaState: meta }, config, NOW).metaState
  assert.deepEqual(loaded.postgame, meta.postgame)
  const junk = sanitizeSave({ ...legacy, metaState: { ...meta, postgame: { depth: -3, shards: "x", progress: NaN } } }, config, NOW).metaState
  assert.equal(junk.postgame!.depth, 0)
  assert.equal(junk.postgame!.shards, 0)
  const notDone = sanitizeSave({ ...legacy, metaState: { ...meta, gameCompleted: false } }, config, NOW).metaState
  assert.equal(notDone.postgame, undefined, "no dawn mine on an unfinished save")
})

test("depth notice: text for every new depth, big every 10", async () => {
  const { dawnDepthNotice } = await import("./clicker-postgame.ts")
  assert.equal(dawnDepthNotice(3, 3), null)
  assert.deepEqual(dawnDepthNotice(0, 1), { text: "새벽의 광산 · 깊이 1 도달, 새벽 조각 +1", big: false })
  assert.equal(dawnDepthNotice(9, 10)!.big, true)
  assert.equal(dawnDepthNotice(10, 11)!.big, false)
})

test("audio: dawn cues and the dawn BGM scene", async () => {
  const { dawnDepthCue, cueVolume } = await import("./clicker-audio-cues.ts")
  const { resolveBgmScene } = await import("./clicker-bgm.ts")
  const { bgmTrackUrl, bgmTrackLoops } = await import("./clicker-bgm-tracks.ts")
  assert.equal(dawnDepthCue(false), "dawnDepth")
  assert.equal(dawnDepthCue(true), "dawnDepthBig")
  assert.ok(Math.abs(cueVolume("dawnDepth") - 10 ** (-4 / 20)) < 1e-9)
  assert.ok(Math.abs(cueVolume("dawnDepthBig") - 10 ** (-2 / 20)) < 1e-9)
  const base = { enteringMine: false, regionIntro: null, endingPhase: null, pendingRebirth: false, endingOpen: false, playSurface: "hub", currentRegionId: "start" }
  assert.equal(resolveBgmScene({ ...base, dawnMine: true }), "dawn")
  assert.equal(resolveBgmScene({ ...base, dawnMine: true, finalBossFight: true }), "boss")
  assert.equal(resolveBgmScene({ ...base, dawnMine: true, endingPhase: "live" }), "silent")
  assert.notEqual(resolveBgmScene(base), "dawn")
  assert.ok(bgmTrackUrl("dawn").endsWith("bgm_dawn_mine_loop_v1_loop.mp3"))
  assert.ok(bgmTrackLoops("dawn"))
})
