import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import test from "node:test"
import { BGM_LOOP_SECONDS } from "../../data/clicker/bgm-loops.ts"
import { CLICKER_REGIONS } from "../../data/clicker/regions.ts"

// use-clicker-bgm plays bgm_<regionId>.mp3; a region without one silently falls back to home.
test("every region has its own generated BGM loop", () => {
  for (const region of CLICKER_REGIONS) {
    assert.ok(region.id in BGM_LOOP_SECONDS, `${region.id} has no entry in bgm-loops.ts`)
  }
})

test("every BGM loop has its file and a usable length", () => {
  for (const [key, seconds] of Object.entries(BGM_LOOP_SECONDS)) {
    assert.ok(existsSync(`public/clicker/audio/bgm_${key}.mp3`), `bgm_${key}.mp3 missing`)
    assert.ok(seconds > 20 && seconds < 180, `${key} loop length ${seconds}s looks wrong`)
  }
})

test("monster hunts have their own battle track", () => {
  assert.ok("battle" in BGM_LOOP_SECONDS)
})
