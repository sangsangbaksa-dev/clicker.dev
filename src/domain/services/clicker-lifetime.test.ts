import assert from "node:assert/strict"
import test from "node:test"
import { clickerConfig } from "../../data/clicker/catalog.ts"
import type { MetaState, RunState } from "../entities/clicker"
import {
  activateSkill,
  createInitialMeta,
  createInitialRun,
  grantAdminEnergy,
  processTick,
  resolveCrisis,
} from "./clicker-engine.ts"

const config = clickerConfig
const now = 9_000_000

function producingRun(meta: MetaState): RunState {
  const run = createInitialRun(now, meta, config)
  return grantAdminEnergy({ ...run, producerLevels: { ...run.producerLevels, [config.producers[0].id]: 20 } }, 1_000)
}

/** Lifetime CORE on meta must grow by exactly what the run earned. */
function assertLifetimeTracks(before: { run: RunState; meta: MetaState }, after: { run: RunState; meta: MetaState }) {
  const runEarned = after.run.lifetimeCoreEnergy - before.run.lifetimeCoreEnergy
  const metaEarned = after.meta.totalCoreEnergy - before.meta.totalCoreEnergy
  assert.ok(runEarned > 0)
  assert.ok(Math.abs(runEarned - metaEarned) < 1e-6, `run +${runEarned} but meta +${metaEarned}`)
}

test("CORE PULSE burst counts toward lifetime CORE", () => {
  const meta = createInitialMeta()
  const run = { ...producingRun(meta), skillItems: { core_pulse: 1 } }
  const used = activateSkill(run, meta, config, "core_pulse", now)
  assert.equal(used.error, undefined)
  assertLifetimeTracks({ run, meta }, used)
})

test("crisis rewards count toward lifetime CORE", () => {
  const meta = createInitialMeta()
  const run = { ...producingRun(meta), instability: 100, crisisActive: true }
  for (const choice of ["RISK_IT", "EMERGENCY_OVERCLOCK"] as const) {
    assertLifetimeTracks({ run, meta }, resolveCrisis(run, meta, config, choice, now, () => 0.9))
  }
  const stabilized = resolveCrisis(run, meta, config, "STABILIZE", now, () => 0.9)
  assert.equal(stabilized.meta.totalCoreEnergy, meta.totalCoreEnergy)
})

test("FEVER finisher burst counts toward lifetime CORE", () => {
  const meta = createInitialMeta()
  const base = producingRun(meta)
  const run: RunState = {
    ...base,
    lastTickAt: now - 500,
    fever: { ...base.fever, phase: "FEVER", remainingTime: 0.3, duration: 10, finisherReady: true },
  }
  const ticked = processTick(run, meta, config, now)
  assert.equal(ticked.run.fever.phase, "COOL_DOWN")
  const produced = ticked.run.lifetimeCoreEnergy - run.lifetimeCoreEnergy
  assert.ok(produced > run.coreEnergy * 0.02, "finisher paid out")
  assertLifetimeTracks({ run, meta }, ticked)
})

test("OVERCLOCK raises instability even without FEVER", () => {
  const meta = createInitialMeta()
  const skill = config.activeSkills.find((s) => s.id === "overclock")!
  const base = createInitialRun(now - 1_000, meta, config)
  const run: RunState = { ...base, activeBuffs: [{ id: "overclock", expiresAt: now + 5_000 }] }
  assert.equal(run.fever.phase, "IDLE")
  const ticked = processTick(run, meta, config, now)
  assert.ok(Math.abs(ticked.run.instability - skill.instabilityPerSecond!) < 1e-9)
})

test("OVERCLOCK adds instability once per tick during FEVER", () => {
  const meta = createInitialMeta()
  const skill = config.activeSkills.find((s) => s.id === "overclock")!
  const base = createInitialRun(now - 1_000, meta, config)
  const run: RunState = {
    ...base,
    fever: { ...base.fever, phase: "FEVER", remainingTime: 10, duration: 10 },
    activeBuffs: [{ id: "overclock", expiresAt: now + 5_000 }],
  }
  const ticked = processTick(run, meta, config, now)
  assert.ok(Math.abs(ticked.run.instability - skill.instabilityPerSecond!) < 1e-9)
})

test("an expired OVERCLOCK adds no instability", () => {
  const meta = createInitialMeta()
  const base = createInitialRun(now - 1_000, meta, config)
  const run: RunState = { ...base, activeBuffs: [{ id: "overclock", expiresAt: now - 1 }] }
  assert.equal(processTick(run, meta, config, now).run.instability, 0)
})
