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

test("forge: odds fall with tier, failures pay, raise the next roll and fill artisan's energy", async () => {
  const lair = await import("./clicker-lair.ts")
  const meta = createInitialMeta()
  const rich = { ...createInitialRun(0, meta, clickerConfig), coreEnergy: 1e15, regionCurrency: { signal_relay: 1e12, phase_vault: 1e12, storm_spire: 1e12, deep_fault: 1e12 } }
  // Rates only go down as the target tier rises.
  for (let i = 2; i < lair.FORGE_SUCCESS_RATES.length; i++) assert.ok(lair.FORGE_SUCCESS_RATES[i] <= lair.FORGE_SUCCESS_RATES[i - 1])
  const atTier8 = { ...rich, gear: { weapon: 8, armor: 0, helmet: 0, amulet: 0 } }
  const odds = lair.forgeOdds(atTier8, "weapon")!
  assert.equal(odds.base, 0.2)
  assert.equal(odds.rate, 0.2)
  // A failed roll costs the full price and keeps the tier.
  const fail = lair.forgeGear(atTier8, clickerConfig, "weapon", () => 0.99)
  assert.equal(fail.success, false)
  assert.equal(gearOf(fail.run).weapon, 8)
  assert.ok(fail.run.coreEnergy < atTier8.coreEnergy)
  const after = lair.forgeOdds(fail.run, "weapon")!
  assert.ok(Math.abs(after.rate - 0.22) < 1e-9, "next roll +10% of base")
  assert.ok(Math.abs(after.energy - 0.2 * lair.FORGE_ENERGY_PER_FAIL) < 1e-9)
  // Keep failing: energy reaches 100% and the next attempt cannot miss.
  let run = fail.run
  let guard = 0
  while (!lair.forgeOdds(run, "weapon")!.guaranteed && guard++ < 50) run = lair.forgeGear(run, clickerConfig, "weapon", () => 0.99).run
  assert.ok(guard < 50)
  const sure = lair.forgeGear(run, clickerConfig, "weapon", () => 0.99)
  assert.equal(sure.success, true)
  assert.equal(gearOf(sure.run).weapon, 9)
  assert.equal(sure.run.forgeFails?.weapon, 0)
  // Tier 1 always lands.
  assert.equal(lair.forgeGear(rich, clickerConfig, "armor", () => 0.999).success, true)
})

test("lair: HUNT monster-only skills — shockwave, weak spot, lifesteal and stun", async () => {
  const engine = await import("./clicker-engine.ts")
  const meta = createInitialMeta()
  const ids = ["hunt_quake", "hunt_weakspot", "hunt_leech", "hunt_stagger"]
  for (const id of ids) assert.ok(clickerConfig.skillNodes.some((n) => n.id === id && n.branch === "HUNT"), id)
  const base = { ...createInitialRun(0, meta, clickerConfig), currentRegionId: "phase_vault", ownedSkillNodeIds: ids }
  const skills = engine.lairSkills(base, clickerConfig)
  assert.equal(skills.quakeInterval, engine.LAIR_QUAKE_BASE_INTERVAL)
  assert.ok(skills.quakeMultiplier > 0 && skills.critChance > 0 && skills.lifesteal > 0 && skills.stunMs > 0)
  let run = enterLair(base, clickerConfig, 0).run
  run = { ...run, lair: { ...run.lair!, bossHp: 1e9, bossMaxHp: 1e9, playerHp: 10 } }
  const plain = strikeLair(run, meta, clickerConfig, 1, () => 0.99)
  assert.deepEqual([plain.procs.quake, plain.procs.weakSpot], [false, false])
  assert.ok(plain.procs.healed > 0, "lifesteal heals on every strike")
  const crit = strikeLair(run, meta, clickerConfig, 1, () => 0)
  assert.equal(crit.procs.weakSpot, true)
  assert.equal(crit.damage, plain.damage * skills.critMultiplier)
  // The 10th strike is a shockwave; the 12th staggers the next swing.
  let r = run
  let tenth
  for (let i = 1; i <= 12; i++) {
    const s = strikeLair(r, meta, clickerConfig, 1, () => 0.99)
    if (i === 10) tenth = s
    if (i === 12) {
      assert.equal(s.procs.stun, true)
      assert.equal(s.run.lair!.nextAttackAt, r.lair!.nextAttackAt + skills.stunMs)
    }
    r = s.run
  }
  assert.equal(tenth!.procs.quake, true)
  assert.equal(tenth!.damage, plain.damage * (1 + skills.quakeMultiplier))
})
