import assert from "node:assert/strict"
import { test } from "node:test"
import {
  BGM_FADE_IN_S,
  CAPTION_FADE_S,
  ENDING_VIDEO_SECONDS,
  LOAD_TIMEOUT_S,
  STALL_LIMIT_S,
  captionAt,
  captionCues,
  endingBgmOn,
  endingStages,
  ENDING_NARROW_VIEWPORT_PX,
  newWatchdog,
  nextEndingStage,
  pickEndingVideoQuality,
  sfxSync,
  shouldStartEnding,
  skipAllowed,
  stepWatchdog,
} from "./clicker-ending-timeline.ts"
import { CLICKER_TRUE_ENDING_STEPS } from "../../data/clicker/ending.ts"

// Same windows as data/clicker/ending.ts (Waldomage ENDING-TIMING.txt).
const steps = [
  { id: "fall", video: "guardian_death" as const, showAt: 1.6, hideAt: 4.4 },
  { id: "breath", video: "guardian_death" as const, showAt: 5.2, hideAt: 8.8 },
  { id: "final", video: "core_awaken" as const, showAt: 2.0, hideAt: 8.4 },
]

test("video lengths match the HQ renders", () => {
  assert.equal(ENDING_VIDEO_SECONDS.guardian_death, 9.5)
  assert.equal(ENDING_VIDEO_SECONDS.core_awaken, 10)
})

test("cues are split per video and keep their windows", () => {
  assert.deepEqual(captionCues(steps, "guardian_death").map((c) => c.id), ["fall", "breath"])
  assert.deepEqual(captionCues(steps, "core_awaken"), [{ id: "final", showAt: 2, hideAt: 8.4 }])
})

test("captions are gone before the 8.75 s white-out and the 9.0 s black of the death video", () => {
  const [final] = captionCues(steps, "core_awaken")
  assert.ok(final.hideAt < 8.75)
  const [, breath] = captionCues(steps, "guardian_death")
  assert.ok(breath.hideAt <= 9.0)
  assert.equal(captionAt([final], 8.4), null)
})

test("caption fades in and out inside its window", () => {
  const cues = captionCues(steps, "guardian_death")
  assert.equal(captionAt(cues, 1.5), null)
  assert.equal(captionAt(cues, 1.6)?.opacity, 0)
  assert.ok(Math.abs(captionAt(cues, 1.6 + CAPTION_FADE_S / 2)!.opacity - 0.5) < 1e-9)
  assert.equal(captionAt(cues, 3)?.opacity, 1)
  assert.ok(Math.abs(captionAt(cues, 4.4 - CAPTION_FADE_S / 2)!.opacity - 0.5) < 1e-9)
  assert.equal(captionAt(cues, 4.8), null) // gap between captions
  assert.equal(captionAt(cues, 6)?.id, "breath")
})

test("bad data is repaired: clamp to video length, drop empty, trim overlaps", () => {
  const cues = captionCues(
    [
      { id: "a", video: "core_awaken", showAt: -1, hideAt: 5 },
      { id: "b", video: "core_awaken", showAt: 4, hideAt: 99 },
      { id: "c", video: "core_awaken", showAt: 7, hideAt: 7 },
      { id: "d", video: "core_awaken", showAt: Number.NaN, hideAt: 3 },
      { id: "e", showAt: 1, hideAt: 2 },
    ],
    "core_awaken",
  )
  assert.deepEqual(cues, [
    { id: "a", showAt: 0, hideAt: 4 },
    { id: "b", showAt: 4, hideAt: 10 },
  ])
})

test("short windows still fade without exceeding 1", () => {
  const cue = captionCues([{ id: "s", video: "core_awaken", showAt: 1, hideAt: 1.2 }], "core_awaken")
  assert.ok(Math.abs(captionAt(cue, 1.1)!.opacity - 1) < 1e-9)
})

test("stages: videos then cards; reduced motion goes straight to cards", () => {
  assert.deepEqual(endingStages(false), ["guardian_death", "core_awaken", "cards"])
  assert.deepEqual(endingStages(true), ["cards"])
  assert.equal(nextEndingStage("guardian_death", false), "core_awaken")
  assert.equal(nextEndingStage("core_awaken", false), "cards")
  assert.equal(nextEndingStage("cards", false), null)
  assert.equal(nextEndingStage("cards", true), null)
})

test("skip: guarded right after start, never on key repeat, never on cards", () => {
  assert.equal(skipAllowed({ stage: "guardian_death", elapsedS: 0.1 }), false)
  assert.equal(skipAllowed({ stage: "guardian_death", elapsedS: 0.7 }), true)
  assert.equal(skipAllowed({ stage: "core_awaken", elapsedS: 3, viaKey: { repeat: true } }), false)
  assert.equal(skipAllowed({ stage: "core_awaken", elapsedS: 3, viaKey: { repeat: false } }), true)
  assert.equal(skipAllowed({ stage: "cards", elapsedS: 30 }), false)
})

test("sfx follows the video clock", () => {
  assert.deepEqual(sfxSync(2, 2.05, "guardian_death"), { seekTo: null, stop: false })
  assert.deepEqual(sfxSync(2, 1.5, "guardian_death"), { seekTo: 2, stop: false })
  assert.deepEqual(sfxSync(9.5, 9.5, "guardian_death"), { seekTo: null, stop: true })
  assert.deepEqual(sfxSync(5, 0, "core_awaken"), { seekTo: 5, stop: false }) // late start after an autoplay block
})

test("ending score only on cards", () => {
  assert.equal(endingBgmOn("cards"), true)
  assert.equal(endingBgmOn("guardian_death"), false)
  assert.ok(BGM_FADE_IN_S > 0)
})

test("watchdog: load timeout, stall limit, hidden tab and ended never expire", () => {
  let w = newWatchdog()
  let expired = false
  for (let t = 0; t < LOAD_TIMEOUT_S + 1 && !expired; t += 0.5) {
    ;({ next: w, expired } = stepWatchdog(w, { dtS: 0.5, videoT: 0, hidden: false, ended: false }))
  }
  assert.equal(expired, true)

  w = newWatchdog()
  for (let i = 0; i < 100; i++) {
    ;({ next: w, expired } = stepWatchdog(w, { dtS: 0.5, videoT: 0, hidden: true, ended: false }))
    assert.equal(expired, false)
  }

  w = newWatchdog()
  let videoT = 0
  for (let i = 0; i < 40; i++) {
    videoT += 0.5
    ;({ next: w, expired } = stepWatchdog(w, { dtS: 0.5, videoT, hidden: false, ended: false }))
    assert.equal(expired, false) // healthy playback
  }
  expired = false
  for (let t = 0; t < STALL_LIMIT_S + 1 && !expired; t += 0.5) {
    ;({ next: w, expired } = stepWatchdog(w, { dtS: 0.5, videoT, hidden: false, ended: false }))
  }
  assert.equal(expired, true)
})

test("ending starts once: also after reload, never when sealed or already running", () => {
  assert.equal(shouldStartEnding({ bossDefeated: true, gameCompleted: false, active: false }), true)
  assert.equal(shouldStartEnding({ bossDefeated: true, gameCompleted: false, active: true }), false)
  assert.equal(shouldStartEnding({ bossDefeated: true, gameCompleted: true, active: false }), false)
  assert.equal(shouldStartEnding({ bossDefeated: false, gameCompleted: false, active: false }), false)
})

test("shipped ending.ts steps all land on a video with valid, sorted, in-range windows", () => {
  const all = [...captionCues(CLICKER_TRUE_ENDING_STEPS, "guardian_death"), ...captionCues(CLICKER_TRUE_ENDING_STEPS, "core_awaken")]
  assert.deepEqual(all.map((c) => c.id).sort(), CLICKER_TRUE_ENDING_STEPS.map((s) => s.id).sort())
  for (const s of CLICKER_TRUE_ENDING_STEPS) {
    const cue = all.find((c) => c.id === s.id)!
    assert.equal(cue.showAt, s.showAt)
    assert.equal(cue.hideAt, s.hideAt) // nothing had to be trimmed
  }
})

test("720p cut for narrow viewports, data-saver and slow connections; HQ otherwise or when unknown", () => {
  assert.equal(pickEndingVideoQuality({ viewportWidth: 1366 }), "hq")
  assert.equal(pickEndingVideoQuality({ viewportWidth: 1920, effectiveType: "4g", saveData: false }), "hq")
  assert.equal(pickEndingVideoQuality({ viewportWidth: 390 }), "mobile720")
  assert.equal(pickEndingVideoQuality({ viewportWidth: ENDING_NARROW_VIEWPORT_PX }), "mobile720")
  assert.equal(pickEndingVideoQuality({ viewportWidth: ENDING_NARROW_VIEWPORT_PX + 1 }), "hq")
  assert.equal(pickEndingVideoQuality({ viewportWidth: 1920, saveData: true }), "mobile720")
  for (const effectiveType of ["slow-2g", "2g", "3g"]) assert.equal(pickEndingVideoQuality({ viewportWidth: 1920, effectiveType }), "mobile720")
  assert.equal(pickEndingVideoQuality({ viewportWidth: Number.NaN }), "hq")
  assert.equal(pickEndingVideoQuality({ viewportWidth: 0 }), "hq")
})
