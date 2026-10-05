import assert from "node:assert/strict"
import test from "node:test"
import {
  ATTACK_MS,
  DEFEAT_HOLD_MS,
  GUARDIAN_CLIPS,
  HIT_CLIP_COOLDOWN_MS,
  NEUTRAL_POSE,
  allFrames,
  enrageLevel,
  frameId,
  kick,
  lungeScale,
  registerAppear,
  registerAttack,
  registerDefeat,
  registerHit,
  sampleMotion,
  settleMotion,
  startMotion,
} from "./clicker-guardian-motion.ts"
import { clipDurationMs } from "./clicker-sprite-clock.ts"

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} !~ ${b}`)
const weights = (s: ReturnType<typeof sampleMotion>) => s.layers.reduce((n, l) => n + l.weight, 0)

test("appear plays, then idle takes over on the same picture (appear_05 == idle_00)", () => {
  const s0 = startMotion(0)
  assert.equal(sampleMotion(s0, 0).phase, "appear")
  assert.equal(sampleMotion(s0, 0).layers[0]!.clip, "appear")
  const dur = clipDurationMs(GUARDIAN_CLIPS.appear)
  const end = sampleMotion(s0, dur + 1)
  assert.equal(end.phase, "idle")
  assert.equal(end.layers[0]!.clip, "idle")
  assert.equal(end.layers[0]!.index, 0)
  const last = sampleMotion(s0, dur - 1)
  assert.equal(last.layers.find((l) => l.weight > 0.5)!.index, 5)
})

test("layer weights always sum to 1 across a whole session", () => {
  let s = startMotion(0)
  for (let t = 0; t < 12000; t += 7) {
    if (t === 2000 || t === 2100 || t === 2130 || t === 3000) s = registerHit(s, t)
    if (t === 4000) s = registerAttack(s, t)
    if (t === 8000) s = registerDefeat(s, t)
    for (const reduced of [false, true]) {
      const m = sampleMotion(s, t, { reduced, enrage: (t % 1000) / 1000 })
      near(weights(m), 1, 1e-6)
      assert.ok(m.layers.every((l) => l.weight > 0 && l.index >= 0 && l.index < GUARDIAN_CLIPS[l.clip].frames))
      assert.ok(m.opacity >= 0 && m.opacity <= 1 && m.shadow.opacity >= 0 && m.shadow.opacity <= 1)
    }
  }
})

test("a hit shows the flash clip, then eases back into the idle loop", () => {
  let s = settleMotion(startMotion(0), 2000)
  s = registerHit(s, 2000)
  const during = sampleMotion(s, 2100)
  assert.ok(during.layers.some((l) => l.clip === "hit"))
  const after = sampleMotion(s, 2000 + 250 + 60)
  assert.ok(after.layers.some((l) => l.clip === "hit") && after.layers.some((l) => l.clip === "idle"), "settling mixes hit + idle")
  const gone = sampleMotion(s, 2000 + 250 + 200)
  assert.ok(gone.layers.every((l) => l.clip === "idle"))
})

test("rapid taps restart the recoil every time but the flash clip at most every cooldown", () => {
  let s = settleMotion(startMotion(0), 2000)
  s = registerHit(s, 2000)
  const first = s.hitClipAt
  s = registerHit(s, 2060)
  s = registerHit(s, 2120)
  assert.equal(s.hitClipAt, first)
  assert.equal(s.hits.length, 3)
  s = registerHit(s, 2000 + HIT_CLIP_COOLDOWN_MS)
  assert.equal(s.hitClipAt, 2000 + HIT_CLIP_COOLDOWN_MS)
  // flash count over 3 s of 12 taps/s: bounded by 1000 / cooldown per second (4/s)
  let flashes = 0
  let st = settleMotion(startMotion(0), 2000)
  for (let t = 2000; t < 5000; t += 1000 / 12) {
    const before = st.hitClipAt
    st = registerHit(st, t)
    if (st.hitClipAt !== before) flashes++
  }
  assert.ok(flashes / 3 <= 1000 / HIT_CLIP_COOLDOWN_MS + 0.01, `flashes/s ${flashes / 3}`)
})

test("hit recoil squashes and leans about the feet, then fully relaxes", () => {
  let s = settleMotion(startMotion(0), 2000)
  s = registerHit(s, 2000)
  const peak = sampleMotion(s, 2000 + 55).pose
  assert.ok(peak.scaleY < 0.96 && peak.scaleX > 1.02)
  assert.ok(Math.abs(peak.skewDeg) > 1)
  const rest = sampleMotion(s, 2000 + 600).pose
  near(rest.scaleX, 1, 1e-9)
  near(rest.scaleY, 1, 1e-9)
  near(rest.skewDeg, 0, 1e-9)
  const next = registerHit(s, 2300)
  const second = sampleMotion(next, 2300 + 55).pose
  assert.ok(Math.sign(second.skewDeg) !== Math.sign(peak.skewDeg), "lean flips side on consecutive hits")
})

test("poses never move the feet: only scale + skew, bounded", () => {
  let s = settleMotion(startMotion(0), 2000)
  for (let t = 2000; t < 2400; t += 20) s = registerHit(s, t)
  s = registerAttack(s, 2300)
  for (let t = 2000; t < 3200; t += 5) {
    const p = sampleMotion(s, t, { enrage: 1 }).pose
    assert.ok(p.scaleX > 0.9 && p.scaleX < 1.2 && p.scaleY > 0.88 && p.scaleY < 1.2, `${t} ${p.scaleX} ${p.scaleY}`)
    assert.ok(Math.abs(p.skewDeg) <= 3.1)
    assert.equal(Object.keys(p).includes("y"), false)
  }
})

test("attack lunge: dip, surge, return", () => {
  assert.equal(lungeScale(-5), 1)
  assert.equal(lungeScale(ATTACK_MS + 1), 1)
  assert.ok(lungeScale(0.25 * ATTACK_MS) < 1)
  near(lungeScale(0.55 * ATTACK_MS), 1.05, 1e-9)
  assert.ok(lungeScale(0.8 * ATTACK_MS) < 1.05 && lungeScale(0.8 * ATTACK_MS) > 1)
})

test("enrage pulse: calm at full health, glowing and pulsing when low", () => {
  const s = settleMotion(startMotion(0), 2000)
  const calm = Array.from({ length: 40 }, (_, i) => sampleMotion(s, 2000 + i * 31, { enrage: 0 }).pose)
  assert.ok(calm.every((p) => p.glow === 0 && p.scaleX === 1))
  const hot = Array.from({ length: 40 }, (_, i) => sampleMotion(s, 2000 + i * 31, { enrage: 1 }).pose)
  assert.ok(Math.max(...hot.map((p) => p.scaleY)) > 1.008)
  assert.ok(Math.max(...hot.map((p) => p.glow)) > 0.9)
  assert.equal(enrageLevel(1), 0)
  assert.equal(enrageLevel(0.4), 0)
  assert.equal(enrageLevel(0.1), 1)
  assert.equal(enrageLevel(0), 1)
  assert.ok(enrageLevel(0.25) > 0.3 && enrageLevel(0.25) < 0.7)
  assert.equal(enrageLevel(Number.NaN), 0)
})

test("defeat collapses, holds the last frame, then rises again; hits are ignored meanwhile", () => {
  let s = settleMotion(startMotion(0), 2000)
  s = registerDefeat(s, 3000)
  const dur = clipDurationMs(GUARDIAN_CLIPS.defeat)
  assert.equal(sampleMotion(s, 3000).layers[0]!.clip, "defeat")
  const hold = sampleMotion(s, 3000 + dur + 500)
  assert.equal(hold.layers[0]!.clip, "defeat")
  assert.equal(hold.layers[0]!.index, 5)
  assert.ok(hold.shadow.opacity < 1)
  assert.equal(registerHit(s, 3100), s)
  assert.equal(registerAttack(s, 3100), s)
  assert.equal(registerDefeat(s, 3200), s)
  const rise = sampleMotion(s, 3000 + dur + DEFEAT_HOLD_MS + 10)
  assert.equal(rise.phase, "appear")
  const back = sampleMotion(s, 3000 + dur + DEFEAT_HOLD_MS + clipDurationMs(GUARDIAN_CLIPS.appear) + 10)
  assert.equal(back.phase, "idle")
  assert.equal(sampleMotion(registerAppear(s, 9000), 9000).phase, "appear")
})

test("reduced motion: no pose, no crossfade, one calm flash swap, plain fades", () => {
  let s = settleMotion(startMotion(0), 2000)
  s = registerHit(s, 2000)
  s = registerAttack(s, 2000)
  for (let t = 2000; t < 4000; t += 25) {
    const m = sampleMotion(s, t, { reduced: true, enrage: 1 })
    assert.deepEqual(m.pose, NEUTRAL_POSE)
    assert.equal(m.layers.length, 1)
    assert.equal(m.layers[0]!.weight, 1)
    assert.equal(m.shadow.widen, 1)
  }
  assert.equal(sampleMotion(s, 2050, { reduced: true }).layers[0]!.clip, "hit")
  assert.equal(sampleMotion(s, 2400, { reduced: true }).layers[0]!.clip, "idle")
  const d = registerDefeat(s, 5000)
  assert.ok(sampleMotion(d, 5000 + 400, { reduced: true }).opacity < 0.05)
  assert.ok(sampleMotion(startMotion(0), 10, { reduced: true }).opacity < 0.1)
})

test("kick shape and ids", () => {
  near(kick(55), 1, 1e-9)
  assert.equal(kick(-1), 0)
  assert.ok(kick(450) < 0.02)
  assert.equal(frameId("idle", 3), "idle_03")
  assert.equal(allFrames().length, 21)
  assert.equal(allFrames()[0]!.clip, "appear")
})

import { lookahead, restrictLayers } from "./clicker-guardian-motion.ts"

test("restrictLayers drops frames that are not loaded and renormalises; lookahead names the next keyframe", () => {
  const layers = [
    { clip: "idle", index: 2, weight: 0.25 },
    { clip: "idle", index: 3, weight: 0.75 },
  ] as const
  const r = restrictLayers(layers, (l) => l.index === 2)
  assert.deepEqual(r, [{ clip: "idle", index: 2, weight: 1 }])
  assert.deepEqual(restrictLayers(layers, () => false), [])
  assert.deepEqual(lookahead([{ clip: "idle", index: 5, weight: 1 }]), [{ clip: "idle", index: 0 }])
  assert.deepEqual(lookahead([{ clip: "hit", index: 2, weight: 1 }]), [])
  assert.deepEqual(lookahead([{ clip: "appear", index: 1, weight: 1 }]), [{ clip: "appear", index: 2 }])
})

import { bossFightOutcome } from "./clicker-guardian-motion.ts"

test("bossFightOutcome: timeout or a lethal blow is a loss, anything else a win", () => {
  assert.equal(bossFightOutcome({ playerHp: 100, endsAt: 5000 }, 4000, 12), "won")
  assert.equal(bossFightOutcome({ playerHp: 100, endsAt: 5000 }, 5000, 12), "lost")
  assert.equal(bossFightOutcome({ playerHp: 12, endsAt: 5000 }, 4000, 12), "lost")
  assert.equal(bossFightOutcome({ playerHp: 13, endsAt: 5000 }, 4000, 12), "won")
})
