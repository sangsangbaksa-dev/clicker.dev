import assert from "node:assert/strict"
import test from "node:test"
import { clickerConfig } from "../../data/clicker/catalog.ts"
import { ARMORS, LAIR_ATTACK_EVERY_MS, LAIR_BOSSES, WEAPONS, forgeGear, gearOf, leaveLair, strikeLair, tickLair, enterLair } from "./clicker-lair.ts"
import { createInitialMeta, createInitialRun } from "./clicker-engine.ts"

test("lair: every region boss has fight stats", () => {
  for (const region of clickerConfig.regions) {
    if (region.monster) assert.ok(LAIR_BOSSES[region.monster.kind], `${region.id} boss missing LAIR_BOSSES entry`)
  }
})

test("lair: gear tiers only get better and cost more", () => {
  for (let i = 1; i < WEAPONS.length; i++) {
    assert.ok(WEAPONS[i].damage > WEAPONS[i - 1].damage)
    assert.ok(WEAPONS[i].cost.core > WEAPONS[i - 1].cost.core)
  }
  for (let i = 1; i < ARMORS.length; i++) {
    assert.ok(ARMORS[i].hp > ARMORS[i - 1].hp)
    assert.ok(ARMORS[i].reduction > ARMORS[i - 1].reduction)
    assert.ok(ARMORS[i].reduction < 1)
  }
})

test("lair: bosses are beatable at a comfortable click rate with tier-matched gear", () => {
  const tierFor: Record<string, number> = { golem: 2, stormbird: 3, worm: 4 }
  for (const [kind, stats] of Object.entries(LAIR_BOSSES)) {
    const tier = tierFor[kind]
    const hits = Math.ceil(stats.hp / WEAPONS[tier].damage)
    const swing = Math.round(stats.damage * (1 - ARMORS[tier].reduction))
    const survivableMs = Math.ceil((100 + ARMORS[tier].hp) / swing) * LAIR_ATTACK_EVERY_MS
    assert.ok(hits / (survivableMs / 1000) <= 2, `${kind} needs ${hits} strikes in ${survivableMs}ms`)
  }
})

test("lair: forging is refused mid-fight, leaving clears the fight, region change ends it", () => {
  const meta = createInitialMeta()
  const base = { ...createInitialRun(0, meta, clickerConfig), currentRegionId: "phase_vault", coreEnergy: 1e9, regionCurrency: { signal_relay: 1e6 } }
  const fight = enterLair(base, clickerConfig, 0).run
  assert.ok(forgeGear(fight, clickerConfig, "weapon").error)
  assert.equal(leaveLair(fight).lair, null)
  assert.equal(tickLair({ ...fight, currentRegionId: "signal_relay" }, clickerConfig, 1).lair, null)
  assert.equal(tickLair(fight, clickerConfig, 1), fight, "no swing yet leaves the run untouched")
})

test("lair: gear index is clamped and strikes on a finished fight do nothing", () => {
  const meta = createInitialMeta()
  const run = { ...createInitialRun(0, meta, clickerConfig), gear: { weapon: 99, armor: -0 } }
  assert.equal(gearOf(run).weapon, WEAPONS.length - 1)
  const idle = strikeLair(run, meta, clickerConfig, 0)
  assert.equal(idle.damage, 0)
  assert.equal(idle.defeated, false)
})
