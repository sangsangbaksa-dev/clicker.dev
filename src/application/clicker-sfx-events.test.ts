import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import test from "node:test"
import { clickerConfig } from "../data/clicker/catalog.ts"
import {
  bindClickerSfxPort,
  GAME_SFX_EVENTS,
  playGameSfx,
  playGameSfxOr,
  skillSfxEvent,
  syncSkillLoops,
  type ClickerSfxPort,
} from "./clicker-sfx-events.ts"
import { LEGACY_LOOP_FILE, LEGACY_SFX_FILE, SFX_PRIORITY_URLS } from "../infrastructure/audio/legacy-sfx-catalog.ts"
import { CLICKER_BGM_URL } from "../infrastructure/audio/clicker-bgm-catalog.ts"

const pub = (url: string) => new URL(`../../public${url}`, import.meta.url)

test("every game sound event maps to a legacy-0929 mp3 that ships in public/", () => {
  assert.equal(GAME_SFX_EVENTS.length, 33)
  for (const ev of GAME_SFX_EVENTS) {
    const file = LEGACY_SFX_FILE[ev]
    assert.match(file, /_legacy\.mp3$/, `${ev} must use a legacy file, not _v1/_v2/_v3/_hq`)
    assert.ok(existsSync(pub(`/clicker/audio/${file}`)), `${file} missing`)
  }
})

test("BGM uses only the 9/29 set plus the loading / rebirth / boss legacy loops", () => {
  for (const [id, url] of Object.entries(CLICKER_BGM_URL)) {
    assert.ok(existsSync(pub(url)), `${id}: ${url} missing`)
    assert.doesNotMatch(url, /_loop_v2|_hq_|_loop_v1/, `${id} still points at a post-9/29 track`)
  }
  assert.equal(Object.keys(CLICKER_BGM_URL).length, 11)
})

test("special skills have a legacy cast sound; shop skills keep the generic cast cue", () => {
  // All eight special skills (blue and green) have their own file; shop skills share `shopSkillUse`.
  const special = clickerConfig.activeSkills.filter((x) => x.unlockRebirth !== undefined && !x.unlocksFever || x.id === "fever_core")
  assert.equal(special.length, 8)
  for (const s of special) assert.ok(skillSfxEvent(s.id), `${s.id} has no sound event`)
  assert.equal(skillSfxEvent("assembly_line"), "skillAssemblyLine")
  assert.equal(skillSfxEvent("overclock_grid"), "skillOverclockGrid")
  assert.equal(skillSfxEvent("laser_focus"), null)
  assert.equal(skillSfxEvent("time_freeze"), "skillTimeStop")
  assert.equal(skillSfxEvent("core_overload"), "skillCoreOverload")
})

test("green skills loop their wav while the buff is up and stop when it ends", () => {
  for (const f of Object.values(LEGACY_LOOP_FILE)) {
    assert.match(f, /_loop_legacy\.wav$/)
    assert.ok(existsSync(pub(`/clicker/audio/${f}`)), `${f} missing`)
  }
  const calls: string[][] = []
  bindClickerSfxPort({ play: () => true, strike() {}, warm() {}, syncLoops: (a) => void calls.push([...a]) })
  syncSkillLoops(["assembly_line", "laser_focus"])
  syncSkillLoops(["assembly_line", "overclock_grid"])
  syncSkillLoops([])
  bindClickerSfxPort(null)
  assert.deepEqual(calls, [["assemblyLine"], ["assemblyLine", "overclockGrid"], []])
})

test("shop skills use the shared file, rebirth steps each have their own", () => {
  assert.equal(LEGACY_SFX_FILE.shopSkillUse, "sfx_shop_skill_use_legacy.mp3")
  assert.equal(LEGACY_SFX_FILE.rebirthCollapse, "sfx_rebirth_collapse_legacy.mp3")
  assert.equal(LEGACY_SFX_FILE.rebirthVoidTear, "sfx_rebirth_void_tear_legacy.mp3")
  assert.equal(LEGACY_SFX_FILE.rebirthRebuild, "sfx_rebirth_rebuild_legacy.mp3")
  assert.equal(LEGACY_SFX_FILE.rebirthSettle, "sfx_rebirth_settle_legacy.mp3")
})

test("click-path priority list names real legacy files (click pair first, no v1/v2/v3/hq)", () => {
  assert.deepEqual(SFX_PRIORITY_URLS.slice(0, 2), ["/clicker/audio/sfx_click.ogg", "/clicker/audio/sfx_click_crit.ogg"])
  for (const url of SFX_PRIORITY_URLS) {
    assert.ok(existsSync(pub(url)), `${url} missing`)
    assert.doesNotMatch(url, /_v[123]\.|_hq|_v1\./)
  }
  assert.equal(new Set(SFX_PRIORITY_URLS).size, SFX_PRIORITY_URLS.length)
})

test("a missing file falls back to the synth cue; a played file does not", () => {
  let synth = 0
  const port = (ok: boolean): ClickerSfxPort => ({ play: () => ok, strike() {}, warm() {}, syncLoops() {} })
  bindClickerSfxPort(null)
  assert.equal(playGameSfx("uiTap"), false)
  playGameSfxOr("uiTap", () => synth++)
  assert.equal(synth, 1)
  bindClickerSfxPort(port(false))
  playGameSfxOr("bossHit", () => synth++)
  assert.equal(synth, 2)
  bindClickerSfxPort(port(true))
  playGameSfxOr("bossHit", () => synth++)
  assert.equal(synth, 2)
  bindClickerSfxPort(null)
})
