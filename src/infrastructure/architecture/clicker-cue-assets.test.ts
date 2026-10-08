import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { ALL_CUE_IDS, CUE_PUBLIC_DIR, CUE_REGISTRY } from "../../domain/services/clicker-audio-cues.ts"

// Binary cues arrive through apply-audio-assets.sh (09-audio-wiring), never inside the diff.
test("every registered cue file exists under public/", () => {
  const publicRoot = join(import.meta.dirname, "../../../public")
  const missing = ALL_CUE_IDS.filter((id) => !existsSync(join(publicRoot, CUE_PUBLIC_DIR, CUE_REGISTRY[id].file)))
  assert.deepEqual(missing, [])
})

test("the boss BGM loop the engine fades in is shipped", () => {
  assert.ok(existsSync(join(import.meta.dirname, "../../../public/clicker/audio/bgm_boss_loop_v1.mp3")))
})
