import assert from "node:assert/strict"
import test from "node:test"
import { clickerConfig as config } from "../../data/clicker/catalog.ts"
import { createInitialMeta, createInitialRun, derivedClick, sanitizeSave } from "./clicker-engine.ts"
import {
  GUARDIAN_RESPAWN_MS,
  currentGuardian,
  guardianHits,
  regionGuardian,
  strikeGuardian,
} from "./clicker-hunt.ts"

const now = 1_000_000

function atRegion(regionId: string) {
  const meta = createInitialMeta()
  const run = { ...createInitialRun(now, meta, config), currentRegionId: regionId }
  return { meta, run }
}

test("every region but home has a guardian", () => {
  for (const region of config.regions) {
    assert.equal(Boolean(regionGuardian(config, region.id)), !region.isHome, region.id)
  }
  const { meta, run } = atRegion("core_chamber")
  assert.equal(currentGuardian(run, meta, config, "core_chamber", now), undefined)
  assert.equal(strikeGuardian(run, meta, config, 1e9, now), undefined)
})

test("a guardian spawns with HP from the click power at the time", () => {
  const { meta, run } = atRegion("signal_relay")
  const g = currentGuardian(run, meta, config, "signal_relay", now)!
  const click = derivedClick(run, meta, config).click
  assert.equal(g.level, 0)
  assert.equal(g.maxHp, click * guardianHits(0))
  assert.equal(g.hp, g.maxHp)
})

test("hits wear it down, a kill pays a bounty and a tougher one respawns", () => {
  const { meta, run } = atRegion("signal_relay")
  const g = currentGuardian(run, meta, config, "signal_relay", now)!
  const hit = strikeGuardian(run, meta, config, g.maxHp / 4, now)!
  assert.equal(hit.killed, false)
  assert.equal(hit.run.guardians.signal_relay.hp, (g.maxHp * 3) / 4)
  assert.equal(hit.run.coreEnergy, run.coreEnergy, "damage alone pays nothing extra")

  const kill = strikeGuardian(hit.run, hit.meta, config, g.maxHp, now)!
  assert.equal(kill.killed, true)
  assert.ok(kill.bounty >= g.maxHp)
  assert.equal(kill.run.coreEnergy, run.coreEnergy + kill.bounty)
  assert.equal(kill.meta.statistics.monsterKills, 1)
  const down = kill.run.guardians.signal_relay
  assert.equal(down.level, 1)
  assert.equal(down.hp, 0)

  // While it is down taps do nothing; after the timer a level-1 guardian stands.
  assert.equal(GUARDIAN_RESPAWN_MS, 30_000, "a fallen guardian revives after 30s")
  assert.equal(strikeGuardian(kill.run, kill.meta, config, 1e9, now + 100), undefined)
  assert.equal(strikeGuardian(kill.run, kill.meta, config, 1e9, now + GUARDIAN_RESPAWN_MS - 1), undefined)
  const next = currentGuardian(kill.run, kill.meta, config, "signal_relay", now + GUARDIAN_RESPAWN_MS)!
  assert.equal(next.level, 1)
  assert.ok(next.maxHp > g.maxHp)
  assert.equal(next.hp, next.maxHp)
})

test("guardian progress survives a save round trip and bad values are repaired", () => {
  const { meta, run } = atRegion("storm_spire")
  const raw = JSON.parse(
    JSON.stringify({
      schemaVersion: config.schemaVersion,
      settings: {},
      metaState: meta,
      runState: { ...run, guardians: { storm_spire: { level: 3, hp: 5, maxHp: 10, respawnAt: 0 }, junk: "x" } },
    }),
  )
  const saved = sanitizeSave(raw, config, now)
  assert.deepEqual(saved.runState.guardians, { storm_spire: { level: 3, hp: 5, maxHp: 10, respawnAt: 0 } })
  const legacy = sanitizeSave({ ...raw, runState: { ...raw.runState, guardians: undefined } }, config, now)
  assert.deepEqual(legacy.runState.guardians, {})
})
