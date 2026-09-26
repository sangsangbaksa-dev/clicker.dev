import assert from "node:assert/strict"
import test from "node:test"
import { clickerConfig as config } from "../../data/clicker/catalog.ts"
import type { RegionHuntDef } from "../entities/clicker.ts"
import {
  HUNT_ATTACKS,
  HUNT_INTRO_MS,
  HUNT_MAX_SHIELDS,
  abandonHunt,
  autoplayHunt,
  createHunt,
  huntPower,
  huntScore,
  isHuntOver,
  isMonsterAlive,
  plannedHuntHp,
  stepHunt,
  strikeMiss,
  strikeMonster,
  summarizeHunt,
  type HuntState,
} from "./clicker-hunt.ts"
import {
  claimRegionHunt,
  createInitialSave,
  grantAdminEnergy,
  buyProducer,
  regionHuntError,
  startClickerGame,
  travelToRegion,
} from "./clicker-engine.ts"

const seeded = (seed: number) => () => (seed = (seed * 16807) % 2147483647) / 2147483647
const relay = config.regions.find((r) => r.id === "signal_relay")!.hunt!
const monsters = config.monsters

function runTo(state: HuntState, def: RegionHuntDef, ms: number, rng: () => number): HuntState {
  let s = state
  for (let t = 0; t < ms; t += 16) s = stepHunt(s, 16, def, monsters, rng)
  return s
}

test("every region away from home has a hunt whose monsters all exist", () => {
  const ids = new Set(monsters.map((m) => m.id))
  for (const region of config.regions) {
    if (region.isHome) {
      assert.equal(region.hunt, undefined)
      continue
    }
    assert.ok(region.hunt, `${region.id} has no hunt`)
    for (const id of [...region.hunt.waves.flat(), region.hunt.boss, region.hunt.bossAdd]) {
      assert.ok(ids.has(id), `${region.id}: unknown monster ${id}`)
    }
    assert.equal(monsters.find((m) => m.id === region.hunt!.boss)?.archetype, "BOSS")
    assert.equal(monsters.find((m) => m.id === region.hunt!.bossAdd)?.archetype, "SWARMER")
  }
})

test("the hunt opens with an intro, then spawns the first wave", () => {
  const rng = seeded(3)
  let s = createHunt(relay, monsters, { power: 1, critChance: 0 })
  assert.equal(s.phase, "intro")
  assert.equal(s.monsters.length, 0)
  s = runTo(s, relay, HUNT_INTRO_MS + 20, rng)
  assert.equal(s.phase, "fight")
  assert.equal(s.monsters.length, relay.waves[0].length)
  assert.ok(s.events.some((e) => e.kind === "wave"))
})

test("strikes deal power × combo damage, kills advance the wave, and the boss ends it", () => {
  const rng = seeded(9)
  let s = runTo(createHunt(relay, monsters, { power: 1, critChance: 0 }), relay, HUNT_INTRO_MS + 700, rng)
  const first = s.monsters[0]
  s = strikeMonster(s, first.uid, false, relay, monsters, rng)
  assert.equal(s.monsters[0].hp, first.maxHp - 1)
  assert.equal(s.combo, 1)
  const hunt = autoplayHunt(relay, monsters, { power: 3, critChance: 0.1, tapsPerSec: 8, accuracy: 1, reactionMs: 200 }, rng)
  assert.equal(hunt.phase, "won")
  assert.ok(hunt.bossDown)
  assert.equal(huntScore(hunt), 1)
  assert.equal(summarizeHunt(hunt).flawless, true)
})

test("a strike on a dead or unborn monster, or outside the fight, does nothing", () => {
  const rng = seeded(4)
  const intro = createHunt(relay, monsters, { power: 1, critChance: 0 })
  assert.equal(strikeMonster(intro, 1, false, relay, monsters, rng), intro)
  let s = runTo(intro, relay, HUNT_INTRO_MS + 10, rng)
  const unborn = s.monsters.find((m) => !isMonsterAlive(m, s.elapsed))
  if (unborn) assert.equal(strikeMonster(s, unborn.uid, false, relay, monsters, rng), s)
  s = runTo(s, relay, 800, rng)
  const target = s.monsters[0]
  for (let i = 0; i < 20; i++) s = strikeMonster(s, target.uid, false, relay, monsters, rng)
  const dead = s.monsters.find((m) => m.uid === target.uid)
  assert.ok(dead && dead.deadAt >= 0)
  assert.equal(strikeMonster(s, target.uid, false, relay, monsters, rng), s)
})

test("the weak point only counts while it is open, and pays triple", () => {
  const rng = seeded(21)
  let s = createHunt(relay, monsters, { power: 1, critChance: 0 })
  s = { ...s, phase: "fight", elapsed: 5000, fightStartedAt: 0 }
  const golem = monsters.find((m) => m.id === "relay_golem")!
  const base = {
    uid: 99, defId: golem.id, name: golem.name, archetype: golem.archetype, x: 0.5, y: 0.5, vx: 0, vy: 0,
    hp: golem.hp, maxHp: golem.hp, bornAt: 0, chargeFrom: -1, chargeHits: 0, nextAttackAt: Infinity,
    weakUntil: 0, nextWeakAt: Infinity, stunUntil: 0, turnAt: Infinity, lastHitAt: -Infinity, deadAt: -1,
    addsCalled: 0, isAdd: false,
  }
  const closed = strikeMonster({ ...s, monsters: [base] }, 99, true, relay, monsters, rng)
  assert.equal(closed.monsters[0].hp, golem.hp - 1)
  const open = strikeMonster({ ...s, monsters: [{ ...base, weakUntil: 6000 }] }, 99, true, relay, monsters, rng)
  assert.equal(open.monsters[0].hp, golem.hp - 3)
  assert.equal(open.weakHits, 1)
})

test("an uninterrupted charge costs a shield; enough hits interrupt and stun it", () => {
  const rng = seeded(8)
  const wisp = monsters.find((m) => m.id === "static_wisp")!
  const spec = HUNT_ATTACKS.CASTER!
  const caster = {
    uid: 7, defId: wisp.id, name: wisp.name, archetype: wisp.archetype, x: 0.5, y: 0.5, vx: 0, vy: 0,
    hp: 50, maxHp: 50, bornAt: 0, chargeFrom: -1, chargeHits: 0, nextAttackAt: 1000,
    weakUntil: 0, nextWeakAt: Infinity, stunUntil: 0, turnAt: Infinity, lastHitAt: -Infinity, deadAt: -1,
    addsCalled: 0, isAdd: false,
  }
  const start: HuntState = {
    ...createHunt(relay, monsters, { power: 1, critChance: 0 }),
    phase: "fight",
    elapsed: 0,
    fightStartedAt: 0,
    monsters: [caster],
  }
  // Left alone: the charge lands.
  const hit = runTo(start, relay, 1000 + spec.charge + 100, rng)
  assert.equal(hit.shields, HUNT_MAX_SHIELDS - 1)
  assert.ok(hit.events.some((e) => e.kind === "shield"))
  // Interrupted: no shield lost, stunned with the weak point open.
  let s = runTo(start, relay, 1100, rng)
  assert.ok(s.monsters[0].chargeFrom >= 0)
  for (let i = 0; i < spec.interruptHits; i++) s = strikeMonster(s, 7, false, relay, monsters, rng)
  assert.equal(s.monsters[0].chargeFrom, -1)
  assert.ok(s.monsters[0].stunUntil > s.elapsed)
  assert.ok(s.monsters[0].weakUntil > s.elapsed)
  assert.equal(s.interrupts, 1)
  s = runTo(s, relay, spec.charge, rng)
  assert.equal(s.shields, HUNT_MAX_SHIELDS)
})

test("losing every shield ends the hunt early", () => {
  const rng = seeded(12)
  // A hunter who never taps: casters and brutes wear the shields down.
  const idle = autoplayHunt(relay, monsters, { power: 1, critChance: 0, tapsPerSec: 0.01, accuracy: 0 }, rng)
  assert.ok(isHuntOver(idle))
  assert.ok(idle.phase === "lost" || idle.phase === "timeout")
  assert.equal(huntScore(idle), 0)
})

test("misses break the combo but never the score", () => {
  const rng = seeded(5)
  let s = runTo(createHunt(relay, monsters, { power: 1, critChance: 0 }), relay, HUNT_INTRO_MS + 700, rng)
  s = strikeMonster(s, s.monsters[0].uid, false, relay, monsters, rng)
  const damage = s.damage
  s = strikeMiss(s, 0.1, 0.1)
  assert.equal(s.combo, 0)
  assert.equal(s.misses, 1)
  assert.equal(s.damage, damage)
})

test("time runs out into a timeout, and leaving early settles what was done", () => {
  const rng = seeded(6)
  let s = runTo(createHunt(relay, monsters, { power: 1, critChance: 0 }), relay, HUNT_INTRO_MS + 700, rng)
  s = strikeMonster(s, s.monsters[0].uid, false, relay, monsters, rng)
  const left = abandonHunt(s)
  assert.equal(left.phase, "timeout")
  assert.ok(huntScore(left) > 0 && huntScore(left) < 0.05)
  const timedOut = runTo(s, relay, relay.timeLimitSec * 1000 + 200, rng)
  assert.ok(isHuntOver(timedOut))
})

test("the boss calls in adds at 2/3 and 1/3 HP and takes them down when it falls", () => {
  const rng = seeded(31)
  const warden = monsters.find((m) => m.id === relay.boss)!
  const boss = {
    uid: 50, defId: warden.id, name: warden.name, archetype: warden.archetype, x: 0.5, y: 0.4, vx: 0, vy: 0,
    hp: warden.hp, maxHp: warden.hp, bornAt: 0, chargeFrom: -1, chargeHits: 0, nextAttackAt: Infinity,
    weakUntil: 0, nextWeakAt: Infinity, stunUntil: 0, turnAt: Infinity, lastHitAt: -Infinity, deadAt: -1,
    addsCalled: 0, isAdd: false,
  }
  let s: HuntState = {
    ...createHunt(relay, monsters, { power: 1, critChance: 0 }),
    phase: "fight",
    elapsed: 1000,
    fightStartedAt: 0,
    wave: relay.waves.length,
    nextUid: 60,
    monsters: [boss],
  }
  const hpOf = (st: HuntState) => st.monsters.find((m) => m.uid === 50)!.hp
  while (hpOf(s) > (warden.hp * 2) / 3) s = strikeMonster(s, 50, false, relay, monsters, rng)
  assert.equal(s.monsters.filter((m) => m.isAdd).length, 2)
  while (hpOf(s) > warden.hp / 3) s = strikeMonster(s, 50, false, relay, monsters, rng)
  assert.equal(s.monsters.filter((m) => m.isAdd).length, 4)
  assert.ok(s.events.some((e) => e.kind === "enrage"))
  while (hpOf(s) > 0) s = strikeMonster(s, 50, false, relay, monsters, rng)
  assert.equal(s.monsters.filter((m) => m.isAdd).length, 4)
  assert.ok(s.monsters.every((m) => m.deadAt >= 0))
  assert.ok(s.bossDown)
  s = runTo(s, relay, 100, rng)
  assert.equal(s.phase, "won")
})

test("a decent hunter clears every region's hunt at a worldline that reaches it", () => {
  for (const [i, region] of config.regions.filter((r) => r.hunt).entries()) {
    const rng = seeded(100 + i)
    let wins = 0
    for (let k = 0; k < 10; k++) {
      const s = autoplayHunt(region.hunt!, monsters, { power: huntPower(i), critChance: 0.1, tapsPerSec: 5, accuracy: 0.85, reactionMs: 600 }, rng)
      if (s.phase === "won") wins++
    }
    assert.ok(wins >= 8, `${region.id}: ${wins}/10 wins`)
  }
})

test("planned HP covers the waves and the boss, not the adds", () => {
  const hp = (id: string) => monsters.find((m) => m.id === id)!.hp
  assert.equal(plannedHuntHp(relay, monsters), relay.waves.flat().reduce((s, id) => s + hp(id), 0) + hp(relay.boss))
})

test("claiming a hunt pays production by score, records kills and cools down", () => {
  const now = 50_000_000
  let save = startClickerGame(createInitialSave(now, config))
  let run = grantAdminEnergy(save.runState, 1_000_000)
  run = buyProducer(run, save.metaState, config, "solar_node", 10).run
  save = { ...save, runState: travelToRegion(run, config, "signal_relay").run }
  assert.equal(regionHuntError(save.runState, config, "signal_relay", now), undefined)
  assert.ok(regionHuntError(save.runState, config, "phase_vault", now))

  const claim = claimRegionHunt(save.runState, save.metaState, config, "signal_relay", { score: 0.5, kills: 12, bossDown: true, flawless: false, cleared: true }, now)
  assert.equal(claim.error, undefined)
  assert.ok(claim.reward > 0)
  assert.equal(claim.meta.statistics.monstersSlain, 12)
  assert.equal(claim.meta.statistics.bossesSlain, 1)
  assert.equal(claim.meta.statistics.huntsCleared, 1)
  assert.equal(claim.meta.statistics.flawlessHunts, 0)
  assert.ok(regionHuntError(claim.run, config, "signal_relay", now + 1000))

  const farmed = claimRegionHunt(save.runState, save.metaState, config, "signal_relay", { score: 9, kills: 1e6, bossDown: false, flawless: true, cleared: false }, now)
  const full = claimRegionHunt(save.runState, save.metaState, config, "signal_relay", { score: 1, kills: 0, bossDown: false, flawless: false, cleared: false }, now)
  assert.equal(farmed.reward, full.reward)
  assert.ok(farmed.meta.statistics.monstersSlain < 20)
  assert.equal(farmed.meta.statistics.flawlessHunts, 0)
})
