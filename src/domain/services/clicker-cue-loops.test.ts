import assert from "node:assert/strict"
import { test } from "node:test"
import { NO_LOOP_WISHES, dropLoop, loopsToRestart, wishLoop } from "./clicker-cue-loops.ts"

test("a wished loop is remembered and comes back once sound is possible", () => {
  const w = wishLoop(NO_LOOP_WISHES, "bossBreathLoop")
  assert.deepEqual(loopsToRestart(w, false), [])
  assert.deepEqual(loopsToRestart(w, true), ["bossBreathLoop"])
})

test("dropping the loop while muted forgets it: no phantom restart on unmute", () => {
  const w = dropLoop(wishLoop(NO_LOOP_WISHES, "drillLoop"), "drillLoop")
  assert.deepEqual(loopsToRestart(w, true), [])
})

test("one-shot cues are never remembered; repeats and unknown drops return the same set", () => {
  assert.equal(wishLoop(NO_LOOP_WISHES, "bossHit"), NO_LOOP_WISHES)
  const w = wishLoop(NO_LOOP_WISHES, "drillLoop")
  assert.equal(wishLoop(w, "drillLoop"), w)
  assert.equal(dropLoop(w, "bossBreathLoop"), w)
})

test("the sets are immutable: wishing / dropping never mutates the input", () => {
  const a = wishLoop(NO_LOOP_WISHES, "drillLoop")
  const b = wishLoop(a, "bossBreathLoop")
  assert.deepEqual([...a], ["drillLoop"])
  assert.deepEqual([...b].sort(), ["bossBreathLoop", "drillLoop"])
  assert.deepEqual([...dropLoop(b, "drillLoop")], ["bossBreathLoop"])
  assert.equal(NO_LOOP_WISHES.size, 0)
})
