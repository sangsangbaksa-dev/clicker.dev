import assert from "node:assert/strict"
import { test } from "node:test"
import {
  ALL_CUE_IDS,
  CUE_PUBLIC_DIR,
  CUE_REGISTRY,
  DRILL_LOOP_IDLE_MS,
  cueUrl,
  cueVolume,
  drillLoopExpired,
  drillTapPlan,
  guardianAudioPlan,
  navTabCue,
  type GuardianAudioSnap,
} from "./clicker-audio-cues.ts"

test("registry: every cue is an mp3 under the public audio folder, gain never boosts, loops are the beds only", () => {
  assert.equal(ALL_CUE_IDS.length, 17)
  for (const id of ALL_CUE_IDS) {
    const def = CUE_REGISTRY[id]
    assert.match(def.file, /^sfx_[a-z0-9_]+\.mp3$/, id)
    assert.ok(cueUrl(id).startsWith(CUE_PUBLIC_DIR), id)
    assert.ok(def.gainDb <= 0, `${id} gain must not boost`)
    const v = cueVolume(id)
    assert.ok(v > 0 && v <= 1, id)
  }
  assert.deepEqual(ALL_CUE_IDS.filter((id) => CUE_REGISTRY[id].loop).sort(), ["bossBreathLoop", "drillLoop"])
  assert.equal(new Set(ALL_CUE_IDS.map((id) => CUE_REGISTRY[id].file)).size, ALL_CUE_IDS.length)
})

test("registry: _norm files carry their gain already (0 dB); the rest use volume-map.json", () => {
  for (const id of ALL_CUE_IDS) {
    const def = CUE_REGISTRY[id]
    if (def.file.includes("_norm.")) assert.equal(def.gainDb, 0, id)
  }
  assert.equal(CUE_REGISTRY.bossHit.file, "sfx_finalboss_hit_v1_norm.mp3")
  assert.equal(CUE_REGISTRY.tabMonster.gainDb, -6.8)
  assert.equal(CUE_REGISTRY.tabRebirth.gainDb, -10.4)
  assert.equal(CUE_REGISTRY.tabDrill.gainDb, -8.9)
  assert.equal(CUE_REGISTRY.drillStart.gainDb, -4.0)
  assert.equal(CUE_REGISTRY.drillComplete.gainDb, -2.7)
  assert.equal(CUE_REGISTRY.bossRoar.gainDb, -2.4)
})

test("cueVolume converts dB to linear", () => {
  assert.equal(cueVolume("bossHit"), 1)
  assert.ok(Math.abs(cueVolume("tabMonster") - 10 ** (-6.8 / 20)) < 1e-12)
  assert.ok(cueVolume("tabRebirth") < cueVolume("tabMonster"))
})

test("navTabCue: only the three route pills have a cue", () => {
  assert.equal(navTabCue("MONSTER"), "tabMonster")
  assert.equal(navTabCue("REBIRTH"), "tabRebirth")
  assert.equal(navTabCue("DRILL"), "tabDrill")
  for (const id of ["CLICK", "PRODUCTION", "FEVER", "UTILITY"] as const) assert.equal(navTabCue(id), null)
})

test("drillTapPlan: first tap starts the hum, middle taps keep it, the bore completes and stops it", () => {
  assert.deepEqual(drillTapPlan(false, 0), { play: ["drillStart"], loop: "start" })
  assert.deepEqual(drillTapPlan(true, 0), { play: [], loop: "keep" })
  assert.deepEqual(drillTapPlan(true, 123), { play: ["drillComplete"], loop: "stop" })
  assert.deepEqual(drillTapPlan(false, 5), { play: ["drillComplete"], loop: "stop" })
})

test("drillLoopExpired after the idle window", () => {
  assert.equal(drillLoopExpired(DRILL_LOOP_IDLE_MS - 1), false)
  assert.equal(drillLoopExpired(DRILL_LOOP_IDLE_MS), true)
})

const snap = (o: Partial<GuardianAudioSnap> = {}): GuardianAudioSnap => ({ fighting: false, hits: 0, attacks: 0, defeats: 0, enrage: 0, ...o })

test("guardianAudioPlan: appear on fight start, bed while fighting", () => {
  assert.deepEqual(guardianAudioPlan(snap(), snap({ fighting: true })), { play: ["bossAppear", "bossRoar"], breath: "start" })
  assert.deepEqual(guardianAudioPlan(null, snap({ fighting: true })), { play: [], breath: "start" })
  assert.deepEqual(guardianAudioPlan(null, snap()), { play: [], breath: null })
  assert.deepEqual(guardianAudioPlan(snap({ fighting: true }), snap({ fighting: true })), { play: [], breath: null })
})

test("guardianAudioPlan: hit, lunge stomp, enrage crossing fire once each", () => {
  const f = snap({ fighting: true })
  assert.deepEqual(guardianAudioPlan(f, { ...f, hits: 1 }), { play: ["bossHit"], breath: null })
  assert.deepEqual(guardianAudioPlan(f, { ...f, attacks: 1 }), { play: ["bossStomp"], breath: null })
  assert.deepEqual(guardianAudioPlan(f, { ...f, hits: 1, attacks: 1 }).play, ["bossHit", "bossStomp"])
  assert.deepEqual(guardianAudioPlan({ ...f, enrage: 0.4 }, { ...f, enrage: 0.6 }), { play: ["bossEnrage"], breath: null })
  assert.deepEqual(guardianAudioPlan({ ...f, enrage: 0.6 }, { ...f, enrage: 0.9 }), { play: [], breath: null })
})

test("guardianAudioPlan: defeat plays the collapse (not a hit) and stops the bed; a loss only stops the bed", () => {
  const f = snap({ fighting: true, hits: 3 })
  assert.deepEqual(guardianAudioPlan(f, snap({ fighting: true, hits: 4, defeats: 1 })), { play: ["bossDefeat"], breath: "stop" })
  assert.deepEqual(guardianAudioPlan(f, snap({ hits: 3 })), { play: [], breath: "stop" })
  // after the fight the counters still tick (the collapse is counted one render later)
  assert.deepEqual(guardianAudioPlan(snap({ hits: 3 }), snap({ hits: 3, defeats: 1 })), { play: ["bossDefeat"], breath: "stop" })
  assert.deepEqual(guardianAudioPlan(snap({ hits: 3 }), snap({ hits: 4 })), { play: [], breath: null })
})
