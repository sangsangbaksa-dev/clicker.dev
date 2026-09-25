import assert from "node:assert/strict"
import test from "node:test"
import { clickerConfig as config } from "../../data/clicker/catalog.ts"
import { createInitialSave, grantStrikeUnits, processClick } from "./clicker-engine.ts"
import {
  ACTIVITY_TARGET,
  HUNT_HIT_PAYOUT,
  MONSTERS,
  VAULT_CHAIN_MAX,
  VAULT_GOOD_HALF,
  VAULT_PAYOUT,
  VAULT_PERFECT_HALF,
  dialOffset,
  huntKillBounty,
  pickMonster,
  referenceRegionYield,
  regionActivity,
  vaultGrade,
  vaultLock,
  vaultSpamUnitsPerSecond,
  referenceUnitsPerSecond,
} from "./clicker-region-activity.ts"

const NOW = 40_000_000
const region = (id: string) => config.regions.find((r) => r.id === id)!
const home = config.regions.find((r) => r.isHome)!

test("every region has its own session activity", () => {
  const activities = config.regions.map((r) => regionActivity(r))
  assert.equal(regionActivity(home), "mine")
  assert.equal(new Set(activities).size, config.regions.length)
})

test("reference session yield hits each region's target vs Core Mine (±3%)", () => {
  const base = referenceRegionYield(home)
  for (const r of config.regions) {
    const ratio = referenceRegionYield(r) / base
    const target = ACTIVITY_TARGET[regionActivity(r)]
    assert.ok(Math.abs(ratio / target - 1) <= 0.03, `${r.id}: ${ratio.toFixed(3)} vs target ${target}`)
  }
})

test("later regions pay more per session, in unlock order", () => {
  const byUnlock = [...config.regions].sort((a, b) => a.unlockAtLifetimeEnergy - b.unlockAtLifetimeEnergy)
  for (let i = 1; i < byUnlock.length; i++) {
    assert.ok(referenceRegionYield(byUnlock[i]) > referenceRegionYield(byUnlock[i - 1]), byUnlock[i].id)
  }
})

test("Relay vs Vault trade off: Relay keeps the better idle bonus, Vault the better session", () => {
  const relay = region("signal_relay")
  const vault = region("phase_vault")
  assert.ok((relay.productionMultiplier ?? 1) > (vault.productionMultiplier ?? 1))
  assert.ok(referenceRegionYield(vault) > referenceRegionYield(relay))
  for (const r of [relay, vault]) assert.ok((r.productionMultiplier ?? 1) > (home.productionMultiplier ?? 1))
})

test("bigger monsters live longer and pay more per HP", () => {
  const kinds = Object.values(MONSTERS).sort((a, b) => a.hp - b.hp)
  for (let i = 1; i < kinds.length; i++) {
    assert.ok(kinds[i].bountyPerHp > kinds[i - 1].bountyPerHp)
    assert.ok(kinds[i].lifeMs > kinds[i - 1].lifeMs)
  }
  assert.equal(huntKillBounty("drone"), MONSTERS.drone.hp * MONSTERS.drone.bountyPerHp)
  // A kill is worth far more than the hits that caused it.
  assert.ok(huntKillBounty("drone") > MONSTERS.drone.hp * HUNT_HIT_PAYOUT)
})

test("monster picks follow spawn weights", () => {
  const counts = { drone: 0, wraith: 0, brute: 0 }
  for (let i = 0; i < 1000; i++) counts[pickMonster(i / 1000)]++
  assert.ok(counts.drone > counts.wraith && counts.wraith > counts.brute && counts.brute > 0)
  assert.equal(pickMonster(0.9999), "brute")
})

test("vault grades by distance around the dial, wrapping at 0/1", () => {
  assert.equal(vaultGrade(0.5, 0.5), "perfect")
  assert.equal(vaultGrade(0.99, 0.01), "perfect")
  assert.equal(vaultGrade(0.5 + VAULT_PERFECT_HALF + 0.01, 0.5), "good")
  assert.equal(vaultGrade(0.5 - VAULT_GOOD_HALF - 0.01, 0.5), "miss")
  assert.ok(Math.abs(dialOffset(0.02, 0.98) - 0.04) < 1e-9)
})

test("vault chain grows on locks, caps, and resets on a miss", () => {
  let chain = 0
  let last = 0
  for (let i = 0; i < VAULT_CHAIN_MAX + 3; i++) {
    const lock = vaultLock("perfect", chain)
    assert.ok(lock.payout >= last)
    last = lock.payout
    chain = lock.chain
  }
  assert.equal(chain, VAULT_CHAIN_MAX)
  const miss = vaultLock("miss", chain)
  assert.equal(miss.chain, 0)
  assert.equal(miss.payout, VAULT_PAYOUT.miss)
})

test("strike payout scales a click; strike units match plain click power", () => {
  const save = createInitialSave(NOW, config)
  const noCrit = () => 0.99
  const plain = processClick(save.runState, save.metaState, config, NOW, noCrit)
  const scaled = processClick(save.runState, save.metaState, config, NOW, noCrit, 2.5)
  assert.ok(Math.abs(scaled.result.energyGained - plain.result.energyGained * 2.5) < 1e-9)

  // One strike unit = first click without combo growth (combo stack 1 adds comboPerStack).
  const unit = grantStrikeUnits(save.runState, save.metaState, config, NOW, 1).energy
  assert.ok(Math.abs(plain.result.energyGained - unit * (1 + config.comboPerStack)) < 1e-9)
  const bounty = grantStrikeUnits(save.runState, save.metaState, config, NOW, huntKillBounty("brute"))
  assert.equal(bounty.run.coreEnergy, save.runState.coreEnergy + bounty.energy)
  assert.equal(bounty.run.lifetimeCoreEnergy, save.runState.lifetimeCoreEnergy + bounty.energy)
})

test("strike units pay nothing during a crisis", () => {
  const save = createInitialSave(NOW, config)
  const run = { ...save.runState, crisisActive: true }
  assert.equal(grantStrikeUnits(run, save.metaState, config, NOW, 10).energy, 0)
})

test("blind vault spamming earns well under timed play", () => {
  const timed = referenceUnitsPerSecond("vault")
  for (const taps of [6, 10, 20]) {
    assert.ok(vaultSpamUnitsPerSecond(taps) < timed * 0.5, `${taps}/s spam: ${vaultSpamUnitsPerSecond(taps).toFixed(2)}`)
  }
})
