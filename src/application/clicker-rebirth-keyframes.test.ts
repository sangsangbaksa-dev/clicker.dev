import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { RebirthPhaseArt } from "../data/clicker/rebirth-assets.ts"
import { REBIRTH_KEYFRAME_PHASES } from "../domain/services/clicker-rebirth-keyframes.ts"

const PUBLIC = join(import.meta.dirname, "../../public")

test("every beat's plate is its own keyframe file and the file ships in public/", () => {
  const srcs = REBIRTH_KEYFRAME_PHASES.map((p) => RebirthPhaseArt.plateForPhase(p, "focus_line"))
  assert.equal(new Set(srcs).size, 6)
  for (const src of srcs) assert.ok(existsSync(join(PUBLIC, src)), `${src} is missing (run the stack's apply-assets script)`)
})
