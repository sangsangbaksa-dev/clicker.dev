import assert from "node:assert/strict"
import test from "node:test"
import { REBIRTH_KEYFRAME_PHASES, rebirthKeyframeFile, rebirthKeyframePreloadOrder } from "./clicker-rebirth-keyframes.ts"

test("six beats, six distinct keyframes, numbered in beat order", () => {
  assert.equal(REBIRTH_KEYFRAME_PHASES.length, 6)
  const files = REBIRTH_KEYFRAME_PHASES.map(rebirthKeyframeFile)
  assert.equal(new Set(files).size, 6)
  files.forEach((f, i) => assert.ok(f.startsWith(`rebirth_kf_0${i + 1}_${REBIRTH_KEYFRAME_PHASES[i]}_`), f))
  assert.deepEqual(rebirthKeyframePreloadOrder(), files)
})
