import assert from "node:assert/strict"
import test from "node:test"
import { mayStartVoice, SFX_MAX_VOICES_PER_SAMPLE, SFX_MAX_VOICES_TOTAL } from "./clicker-sfx-voices.ts"

test("voice limiter caps total and per-sample overlap", () => {
  assert.equal(mayStartVoice(0, 0), true)
  assert.equal(mayStartVoice(SFX_MAX_VOICES_TOTAL, 0), false)
  assert.equal(mayStartVoice(0, SFX_MAX_VOICES_PER_SAMPLE), false)
  assert.equal(mayStartVoice(SFX_MAX_VOICES_TOTAL - 1, SFX_MAX_VOICES_PER_SAMPLE - 1), true)
})
