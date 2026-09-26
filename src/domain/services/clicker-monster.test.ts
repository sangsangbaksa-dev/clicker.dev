import assert from "node:assert/strict"
import test from "node:test"
import {
  DEATH_S,
  LANDSCAPE,
  MONSTERS,
  PORTRAIT,
  SPAWN_S,
  floorOf,
  createHunt,
  hitsMonster,
  huntScore,
  isEnraged,
  monsterPosition,
  platesBrokenAt,
  stepHunt,
  type HuntEvent,
  type HuntState,
} from "./clicker-monster.ts"

const DT = 1 / 60

function run(kind: "specter" | "golem", seconds: number, burning: (s: HuntState) => boolean) {
  const def = MONSTERS[kind]
  let s = createHunt(def)
  const events: HuntEvent[] = []
  for (let t = 0; t < seconds; t += DT) {
    const r = stepHunt(def, s, DT, burning(s))
    s = r.state
    events.push(...r.events)
  }
  return { s, events }
}

test("a monster spawns, then takes laser damage only once alive", () => {
  const def = MONSTERS.specter
  let s = createHunt(def)
  s = stepHunt(def, s, SPAWN_S / 2, true).state
  assert.equal(s.hp, def.hp, "no damage while emerging")
  s = stepHunt(def, s, SPAWN_S, true).state
  assert.equal(s.phase, "alive")
})

test("holding the laser breaks every plate in order and then kills", () => {
  for (const kind of ["specter", "golem"] as const) {
    const def = MONSTERS[kind]
    const { s, events } = run(kind, SPAWN_S + 4, (st) => st.phase === "alive" && st.kills === 0)
    assert.equal(s.kills, 1, `${kind} dies`)
    assert.equal(events.filter((e) => e === "plate").length, def.plates, `${kind} sheds all ${def.plates} plates`)
    assert.ok(events.indexOf("enrage") < events.indexOf("kill"), "enrages before dying")
  }
})

test("a continuous burn kills a specter in about 2 s and a golem in about 3 s", () => {
  const timeToKill = (kind: "specter" | "golem") => {
    const def = MONSTERS[kind]
    let s = { ...createHunt(def), phase: "alive" as const }
    let t = 0
    while (s.kills === 0 && t < 10) {
      s = stepHunt(def, s, DT, true).state
      t += DT
    }
    return t
  }
  const specter = timeToKill("specter")
  const golem = timeToKill("golem")
  assert.ok(specter > 1.5 && specter < 2.5, `specter ${specter.toFixed(2)}s`)
  assert.ok(golem > 2.5 && golem < 4, `golem ${golem.toFixed(2)}s`)
})

test("a dead monster respawns after the death + spawn beats, keeping the kill", () => {
  const def = MONSTERS.specter
  let s: HuntState = { ...createHunt(def), phase: "alive", hp: 0.1, platesBroken: def.plates }
  s = stepHunt(def, s, DT, true).state
  assert.equal(s.phase, "dying")
  s = stepHunt(def, s, DEATH_S + DT, false).state
  assert.equal(s.phase, "spawn")
  assert.equal(s.kills, 1)
  assert.equal(s.hp, def.hp)
  assert.equal(s.platesBroken, 0)
})

test("left alone it regenerates HP but lost plates stay lost", () => {
  const def = MONSTERS.golem
  let s: HuntState = { ...createHunt(def), phase: "alive", hp: def.hp * 0.5 }
  s = { ...s, platesBroken: platesBrokenAt(def, s.hp) }
  const plates = s.platesBroken
  for (let t = 0; t < 5; t += DT) s = stepHunt(def, s, DT, false).state
  assert.ok(s.hp > def.hp * 0.5 + 30, "healed")
  assert.equal(s.platesBroken, plates)
})

test("enrage speeds the monster up", () => {
  const def = MONSTERS.specter
  const calm: HuntState = { ...createHunt(def), phase: "alive" }
  const angry: HuntState = { ...calm, hp: def.hp * 0.2 }
  assert.ok(isEnraged(def, angry) && !isEnraged(def, calm))
  const dCalm = stepHunt(def, calm, 0.1, false).state.pathT - calm.pathT
  const dAngry = stepHunt(def, angry, 0.1, false).state.pathT - angry.pathT
  assert.ok(dAngry > dCalm * 1.4)
})

test("hit test follows the moving body and ignores the monster while not alive", () => {
  const def = MONSTERS.golem
  const s: HuntState = { ...createHunt(def), phase: "alive", pathT: 2 }
  const c = monsterPosition("golem", 2)
  assert.ok(hitsMonster(def, s, c))
  assert.ok(!hitsMonster(def, s, { x: c.x + def.hitRx + 5, y: c.y }))
  assert.ok(!hitsMonster(def, { ...s, phase: "dying" }, c))
})

test("monsters stay inside the field and above the floor, wide or upright", () => {
  for (const field of [LANDSCAPE, PORTRAIT]) {
    for (const kind of ["specter", "golem"] as const) {
      const def = MONSTERS[kind]
      for (let t = 0; t < 60; t += 0.05) {
        const p = monsterPosition(kind, t, field)
        const where = `${kind} in ${field.w}x${field.h} at ${t.toFixed(2)}`
        assert.ok(p.x - def.hitRx > 0 && p.x + def.hitRx < field.w, `${where}: x`)
        assert.ok(p.y - def.hitRy > 0 && p.y + def.hitRy < floorOf(field), `${where}: y`)
      }
    }
  }
})

test("score counts kills plus damage on the current monster", () => {
  const def = MONSTERS.specter
  const s: HuntState = { ...createHunt(def), phase: "alive", kills: 2, hp: def.hp / 2 }
  assert.equal(huntScore(def, s), 2.5 / def.killTarget)
  assert.equal(huntScore(def, { ...s, kills: 99 }), 1)
})
