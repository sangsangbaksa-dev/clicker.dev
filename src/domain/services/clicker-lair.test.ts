import assert from "node:assert/strict"
import test from "node:test"
import { clickerConfig } from "../../data/clicker/catalog.ts"
import { ARMORS, LAIR_BOSSES, WEAPONS, forgeGear, gearOf, leaveLair, strikeLair, tickLair, enterLair } from "./clicker-lair.ts"
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

test("lair: each boss is beatable with its world's gear and walls you one tier short", async () => {
  const lair = await import("./clicker-lair.ts")
  const tierFor: Record<string, number> = { golem: 2, stormbird: 3, worm: 4 }
  /** Taps per second needed to kill the boss before it kills you, with every slot at `tier`. */
  const tapsNeeded = (kind: string, tier: number) => {
    const stats = LAIR_BOSSES[kind]
    const gear = { gear: { weapon: tier, armor: tier, helmet: tier, amulet: tier } } as never
    const hits = Math.ceil(stats.hp / WEAPONS[tier].damage)
    const swing = Math.round(stats.damage * (1 - ARMORS[tier].reduction))
    const survivableMs = Math.ceil(lair.playerMaxHp(gear) / swing) * lair.lairAttackEveryMs(gear)
    return hits / (survivableMs / 1000)
  }
  for (const kind of Object.keys(LAIR_BOSSES)) {
    const tier = tierFor[kind]
    assert.ok(tapsNeeded(kind, tier) <= 6, `${kind} too hard with tier ${tier}: ${tapsNeeded(kind, tier).toFixed(1)}/s`)
    assert.ok(tapsNeeded(kind, tier - 1) >= 10, `${kind} too easy one tier short: ${tapsNeeded(kind, tier - 1).toFixed(1)}/s`)
  }
  // Later worlds hit harder and take more to bring down.
  assert.ok(LAIR_BOSSES.golem.hp < LAIR_BOSSES.stormbird.hp && LAIR_BOSSES.stormbird.hp < LAIR_BOSSES.worm.hp)
  assert.ok(LAIR_BOSSES.golem.damage < LAIR_BOSSES.stormbird.damage && LAIR_BOSSES.stormbird.damage < LAIR_BOSSES.worm.damage)
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

test("helmets add HP and amulets slow the boss, each tier strictly better and pricier", async () => {
  const lair = await import("./clicker-lair.ts")
  for (const list of [lair.HELMETS, lair.AMULETS]) {
    for (let i = 1; i < list.length; i++) assert.ok(list[i].cost.core > list[i - 1].cost.core)
  }
  for (let i = 1; i < lair.HELMETS.length; i++) assert.ok(lair.HELMETS[i].hp > lair.HELMETS[i - 1].hp)
  for (let i = 1; i < lair.AMULETS.length; i++) assert.ok(lair.AMULETS[i].slow > lair.AMULETS[i - 1].slow)
  const base = { gear: { weapon: 0, armor: 0, helmet: 0, amulet: 0 } } as unknown as Parameters<typeof lair.playerMaxHp>[0]
  const geared = { gear: { weapon: 0, armor: 0, helmet: 2, amulet: 3 } } as unknown as Parameters<typeof lair.playerMaxHp>[0]
  assert.equal(lair.playerMaxHp(geared) - lair.playerMaxHp(base), lair.HELMETS[2].hp)
  assert.ok(lair.lairAttackEveryMs(geared) > lair.lairAttackEveryMs(base))
  // Old saves without the new slots start them at tier 0.
  assert.deepEqual(lair.gearOf({ gear: { weapon: 1, armor: 2 } } as never), { weapon: 1, armor: 2, helmet: 0, amulet: 0 })
})

test("every gear tier has its painted icon on disk", async () => {
  const { existsSync } = await import("node:fs")
  const lair = await import("./clicker-lair.ts")
  for (const slot of lair.GEAR_SLOTS) {
    for (const tier of lair.GEAR[slot]) assert.ok(existsSync(`public${lair.gearImage(tier)}`), `missing ${tier.id}`)
  }
})
