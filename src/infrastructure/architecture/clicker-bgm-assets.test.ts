import assert from "node:assert/strict"
import { existsSync, statSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { BGM_PUBLIC_DIR, BGM_TRACK_IDS, bgmTrackFileName } from "../../domain/services/clicker-bgm-tracks.ts"

// Binary BGM arrives through scripts/apply-bgm-assets.sh (10-bgm-seam), never inside the diff.
test("every registered BGM file exists under public/ and is not empty", () => {
  const dir = join(import.meta.dirname, "../../../public", BGM_PUBLIC_DIR)
  const bad = BGM_TRACK_IDS.map(bgmTrackFileName).filter((f) => !existsSync(join(dir, f)) || statSync(join(dir, f)).size < 10_000)
  assert.deepEqual(bad, [])
})
