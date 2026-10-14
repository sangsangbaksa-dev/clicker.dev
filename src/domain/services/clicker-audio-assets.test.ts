import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import test from "node:test"
import { CLICKER_BGM_URL } from "../../infrastructure/audio/clicker-bgm-catalog.ts"
import { REBIRTH_AUDIO_CUES, rebirthAudioCueKey } from "../../data/clicker/rebirth-motion.ts"
import { listMappedSfxSampleUrls, rebirthCueSampleUrl } from "../../lib/clicker-sfx.ts"

test("mapped SFX one-shot mp3 files exist in public/", () => {
  const missing = listMappedSfxSampleUrls().filter((p) => !existsSync(`public${p}`))
  assert.deepEqual(missing, [])
})

test("BGM catalog mp3 files exist in public/", () => {
  const missing = Object.values(CLICKER_BGM_URL).filter((p) => !existsSync(`public${p}`))
  assert.deepEqual(missing, [])
})

test("rebirth ceremony HQ/v3 sample paths resolve to real files", () => {
  const names = [
    REBIRTH_AUDIO_CUES.confirm,
    REBIRTH_AUDIO_CUES.collapse,
    REBIRTH_AUDIO_CUES.voidTear,
    REBIRTH_AUDIO_CUES.rebuild,
    REBIRTH_AUDIO_CUES.settle,
    REBIRTH_AUDIO_CUES.stamp("directive_pulse"),
    REBIRTH_AUDIO_CUES.stamp("aurelia_grid"),
    REBIRTH_AUDIO_CUES.stamp("resonance_protocol"),
    REBIRTH_AUDIO_CUES.stamp("volatile_core"),
    REBIRTH_AUDIO_CUES.stamp(rebirthAudioCueKey("hybrid_line")),
  ]
  const missing = names
    .map((name) => rebirthCueSampleUrl(name))
    .filter((url): url is string => Boolean(url))
    .filter((p) => !existsSync(`public${p}`))
  assert.deepEqual(missing, [])
})
