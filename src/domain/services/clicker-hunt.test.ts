import assert from "node:assert/strict"
import test from "node:test"
import {
  HUNT_BAND,
  MONSTERS,
  buildHuntSchedule,
  huntPresentedHp,
  huntScore,
  huntX,
  pickMonster,
  type HuntSpawn,
} from "./clicker-hunt.ts"

/** Deterministic PRNG so schedules are reproducible. */
function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

test("pickMonster follows the spawn weights and covers the whole roll range", () => {
  const counts = { drone: 0, wraith: 0, brute: 0 }
  for (let i = 0; i < 1000; i++) counts[pickMonster(i / 1000)]++
  assert.equal(counts.drone, 600)
  assert.equal(counts.wraith, 300)
  assert.equal(counts.brute, 100)
  assert.equal(pickMonster(0.999999), "brute")
})

test("every scheduled monster can be killed before the run ends", () => {
  for (let seed = 1; seed <= 50; seed++) {
    const schedule = buildHuntSchedule(15_000, seeded(seed))
    assert.ok(schedule.length >= 12, `seed ${seed}: only ${schedule.length} monsters`)
    for (const s of schedule) {
      assert.ok(s.spawnAt + MONSTERS[s.kind].lifeMs <= 15_000, `seed ${seed}: ${s.kind} at ${s.spawnAt}`)
      assert.ok(s.x >= HUNT_BAND.x0 && s.x <= HUNT_BAND.x1)
      assert.ok(s.y >= HUNT_BAND.y0 && s.y <= HUNT_BAND.y1)
    }
    assert.deepEqual(
      schedule.map((s) => s.id),
      schedule.map((_, i) => i),
    )
  }
})

test("a 15 s hunt asks for a busy but humanly possible tap rate", () => {
  let hp = 0
  const runs = 200
  for (let seed = 1; seed <= runs; seed++) hp += huntPresentedHp(buildHuntSchedule(15_000, seeded(seed)), 15_000)
  const perSecond = hp / runs / 15
  assert.ok(perSecond > 2.5 && perSecond < 5, `needs ${perSecond.toFixed(2)} taps/s`)
})

test("drifting monsters bounce inside the band and hovering ones stay put", () => {
  const wraith: HuntSpawn = { id: 0, kind: "wraith", spawnAt: 0, x: 0.8, y: 0.5, dir: 1 }
  let turned = false
  let prev = huntX(wraith, 0)
  for (let ms = 50; ms <= MONSTERS.wraith.lifeMs; ms += 50) {
    const x = huntX(wraith, ms)
    assert.ok(x >= HUNT_BAND.x0 - 1e-9 && x <= HUNT_BAND.x1 + 1e-9, `x ${x} at ${ms}`)
    if (x < prev) turned = true
    prev = x
  }
  assert.ok(turned, "the wraith should bounce off the right edge")
  const left: HuntSpawn = { ...wraith, x: 0.2, dir: -1 }
  assert.ok(huntX(left, 1000) > HUNT_BAND.x0, "bounces off the left edge too")
  const drone: HuntSpawn = { ...wraith, kind: "drone" }
  assert.equal(huntX(drone, 2000), drone.x)
})

test("the score is damage over the HP shown so far, and stray taps count against it", () => {
  const schedule = buildHuntSchedule(15_000, seeded(7))
  const first = schedule[0]
  const firstHp = MONSTERS[first.kind].hp
  assert.equal(huntPresentedHp(schedule, first.spawnAt - 1), 0)
  assert.equal(huntPresentedHp(schedule, first.spawnAt), firstHp)
  assert.equal(huntScore(0, 0, 0), 0)
  assert.equal(huntScore(firstHp, firstHp, 0), 1)
  assert.equal(huntScore(1, 4, 0), 0.25)
  assert.equal(huntScore(4, 4, 2), 0.8)
  assert.equal(huntScore(99, 4, 0), 1, "damage can never exceed the HP on the field")
})

test("quitting right after one hit on a fresh field does not pay a perfect run", () => {
  const schedule = buildHuntSchedule(15_000, seeded(3))
  const elapsed = schedule[1].spawnAt
  const score = huntScore(1, huntPresentedHp(schedule, elapsed), 0)
  assert.ok(score < 0.5, `score ${score}`)
})
