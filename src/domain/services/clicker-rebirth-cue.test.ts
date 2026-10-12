import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import test from "node:test"
import { rebirthCueSampleUrl } from "../../lib/clicker-sfx.ts"

test("hybrid worldline stamp resolves to directive pulse HQ mp3", () => {
  const url = rebirthCueSampleUrl("sfx_rebirth_stamp_adaptive_architect")
  assert.equal(url, "/clicker/audio/sfx_rebirth_stamp_directive_pulse_hq.mp3")
  assert.ok(existsSync(`public${url}`))
})

test("mine BGM loop v2 is the long seamless bed", () => {
  const url = "/clicker/audio/bgm_mine_loop_v2.mp3"
  assert.ok(existsSync(`public${url}`))
})
