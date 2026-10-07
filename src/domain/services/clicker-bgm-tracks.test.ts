import assert from "node:assert/strict"
import { test } from "node:test"
import {
  bgmFadeMsFor,
  bgmFadeStep,
  bgmTrackFadeTarget,
  bgmTracksToWarm,
  BGM_FADE_MS,
  resolveBgmScene,
  type BgmOverlayState,
  type BgmTrackId,
} from "./clicker-bgm.ts"
import {
  BGM_BEDS,
  BGM_PUBLIC_DIR,
  BGM_TRACK_IDS,
  BGM_TRACK_REGISTRY,
  bgmBed,
  bgmTrackFileName,
  bgmTrackLoops,
  bgmTrackUrl,
  MINE_ENTER_CROSSFADE_MS,
  MINE_ENTER_FADE_IN_MS,
  mineEntryVideoMuted,
} from "./clicker-bgm-tracks.ts"

const base: BgmOverlayState = {
  enteringMine: false,
  regionIntro: null,
  endingPhase: null,
  pendingRebirth: false,
  endingOpen: false,
  playSurface: "hub",
  currentRegionId: "storm_spire",
}

test("track table: seam-polished sources for the tracks Waldusic delivered, previous files elsewhere", () => {
  const files = Object.fromEntries(BGM_TRACK_IDS.map((id) => [id, bgmTrackFileName(id)]))
  assert.deepEqual(files, {
    loading: "bgm_loading_loop_v2_seam.mp3",
    hub: "bgm_hub_v2.mp3",
    mine: "bgm_mine_loop_v3_seam.mp3",
    mineEnter: "bgm_mine_enter_10s_seam.mp3",
    chamber: "bgm_chamber_v2.mp3",
    rebirthIntro: "bgm_rebirth_hq_intro.mp3",
    rebirthHq: "bgm_rebirth_hq_loop_seam.mp3",
    boss: "bgm_boss_loop_v1_seam.mp3",
    relay: "bgm_world_relay.mp3",
    vault: "bgm_world_vault.mp3",
    storm: "bgm_world_storm.mp3",
    fault: "bgm_world_fault.mp3",
    heart: "bgm_world_heart.mp3",
    dawn: "bgm_dawn_mine_loop_v1_loop.mp3",
  })
  assert.equal(bgmTrackUrl("mine"), `${BGM_PUBLIC_DIR}bgm_mine_loop_v3_seam.mp3`)
})

test("only the one-shot beds are non-looping; every file name is a plain bgm_ name", () => {
  const oneShots = BGM_TRACK_IDS.filter((id) => !bgmTrackLoops(id)).sort()
  assert.deepEqual(oneShots, ["mineEnter", "rebirthIntro"])
  for (const id of BGM_TRACK_IDS) assert.match(BGM_TRACK_REGISTRY[id].file, /^bgm_[a-z0-9_]+$/)
  assert.equal(new Set(BGM_TRACK_IDS.map(bgmTrackFileName)).size, BGM_TRACK_IDS.length, "no two tracks share a file")
})

test("the mine entrance is a 10 s one-shot that crosses into the mine loop over 4-6 s", () => {
  assert.equal(BGM_TRACK_REGISTRY.mineEnter.durationMs, 10_000)
  assert.ok(MINE_ENTER_CROSSFADE_MS >= 4_000 && MINE_ENTER_CROSSFADE_MS <= 6_000)
  const bed = bgmBed("mineEnter")
  assert.ok(bed)
  assert.equal(bed.intro, "mineEnter")
  assert.equal(bed.loop, "mine")
  assert.deepEqual(bed.advance, { kind: "timer", afterMs: 10_000 - MINE_ENTER_CROSSFADE_MS })
  assert.equal(bed.handoverMs, MINE_ENTER_CROSSFADE_MS)
  // the loop starts while the entrance still has the crossfade length left to play
  assert.ok(10_000 - (bed.advance.kind === "timer" ? bed.advance.afterMs : 0) === MINE_ENTER_CROSSFADE_MS)
})

test("rebirth keeps its intro -> loop bed (ended event, default fade)", () => {
  const bed = BGM_BEDS.rebirth
  assert.ok(bed)
  assert.deepEqual([bed.intro, bed.loop, bed.advance.kind], ["rebirthIntro", "rebirthHq", "ended"])
  assert.equal(bgmFadeMsFor("rebirth", "intro"), BGM_FADE_MS)
  assert.equal(bgmFadeMsFor("rebirth", "loop"), BGM_FADE_MS)
})

test("scene: the door-walk plays the entrance, the mine surface plays the loop, silence still wins", () => {
  assert.equal(resolveBgmScene({ ...base, enteringMine: true }), "mineEnter")
  assert.equal(resolveBgmScene({ ...base, playSurface: "mine" }), "mine")
  // ending / region intro / boot screen are the 'silent' scene and beat the entrance, the mine loop and the boss loop
  for (const silent of [{ endingPhase: "live" }, { regionIntro: {} }, { bootLoading: true }]) {
    assert.equal(resolveBgmScene({ ...base, ...silent, enteringMine: true }), "silent")
    assert.equal(resolveBgmScene({ ...base, ...silent, playSurface: "mine" }), "silent")
    assert.equal(resolveBgmScene({ ...base, ...silent, finalBossFight: true }), "silent")
    assert.equal(resolveBgmScene({ ...base, ...silent, enteringMine: true, finalBossFight: true, pendingRebirth: true }), "silent")
  }
  // the ending's own cue (chamber, not the silent scene) is unchanged
  assert.equal(resolveBgmScene({ ...base, endingOpen: true }), "chamber")
})

test("fade targets: entrance first, then the mine loop; nothing else is audible", () => {
  const targets = (phase: "intro" | "loop") =>
    Object.fromEntries(BGM_TRACK_IDS.map((id) => [id, bgmTrackFadeTarget(id, "mineEnter", false, 0.5, phase)]).filter(([, v]) => v !== 0))
  assert.deepEqual(targets("intro"), { mineEnter: 1 })
  assert.deepEqual(targets("loop"), { mine: 1 })
  for (const id of BGM_TRACK_IDS) assert.equal(bgmTrackFadeTarget(id, "mineEnter", true, 0.5, "loop"), 0, "hidden tab")
  for (const id of BGM_TRACK_IDS) assert.equal(bgmTrackFadeTarget(id, "silent", false, 0.5, "loop"), 0, "silent scene")
  // a plain mine scene ignores the bed phase (the loop is simply on)
  assert.equal(bgmTrackFadeTarget("mine", "mine", false, 0.5, "intro"), 1)
  assert.equal(bgmTrackFadeTarget("mineEnter", "mine", false, 0.5, "intro"), 0)
})

test("both bed tracks are warmed together; single scenes warm themselves", () => {
  assert.deepEqual(bgmTracksToWarm("mineEnter"), ["mineEnter", "mine"])
  assert.deepEqual(bgmTracksToWarm("rebirth"), ["rebirthIntro", "rebirthHq"])
  assert.deepEqual(bgmTracksToWarm("boss"), ["boss"])
  assert.deepEqual(bgmTracksToWarm("silent"), [])
})

test("fade length: quick onto the entrance, the full crossfade for the hand-over, 900 ms elsewhere", () => {
  assert.equal(bgmFadeMsFor("mineEnter", "intro"), MINE_ENTER_FADE_IN_MS)
  assert.equal(bgmFadeMsFor("mineEnter", "loop"), MINE_ENTER_CROSSFADE_MS)
  assert.equal(bgmFadeMsFor("mine", "intro"), BGM_FADE_MS)
  assert.equal(bgmFadeMsFor("boss", "loop"), BGM_FADE_MS)
})

test("simulated hand-over: the loop reaches full level exactly when the entrance track ends, levels sum to 1 throughout", () => {
  const bed = bgmBed("mineEnter")!
  const fadeMs = bgmFadeMsFor("mineEnter", "loop")
  let enter = 1
  let loop = 0
  let t = 0
  const dt = 16
  let maxSumErr = 0
  while (t < fadeMs) {
    enter = bgmFadeStep(enter, bgmTrackFadeTarget("mineEnter", "mineEnter", false, 1, "loop"), dt, fadeMs)
    loop = bgmFadeStep(loop, bgmTrackFadeTarget("mine", "mineEnter", false, 1, "loop"), dt, fadeMs)
    t += dt
    maxSumErr = Math.max(maxSumErr, Math.abs(enter + loop - 1))
  }
  assert.ok(maxSumErr < 1e-9, `linear crossfade keeps gain sum at 1 (err ${maxSumErr})`)
  assert.equal(loop, 1)
  assert.equal(enter, 0)
  // hand-over starts at afterMs and ends (afterMs + crossfade) = the entrance track length
  assert.equal((bed.advance.kind === "timer" ? bed.advance.afterMs : -1) + fadeMs, BGM_TRACK_REGISTRY.mineEnter.durationMs)
})

test("the door-walk video is muted while the BGM bed carries the entrance track (no double audio)", () => {
  assert.equal(mineEntryVideoMuted(false), true)
  assert.equal(mineEntryVideoMuted(true), true)
})

test("registry has an entry for every BgmTrackId used by a scene", () => {
  const ids: BgmTrackId[] = ["loading", "hub", "mine", "mineEnter", "chamber", "rebirthIntro", "rebirthHq", "boss", "relay", "vault", "storm", "fault", "heart", "dawn"]
  assert.deepEqual([...BGM_TRACK_IDS].sort(), [...ids].sort())
})
