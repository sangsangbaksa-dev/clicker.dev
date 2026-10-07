import assert from "node:assert/strict"
import test from "node:test"
import { clickerConfig as config } from "../../data/clicker/catalog.ts"
import { createInitialMeta, rebirthRequirement, worldlineGoal } from "./clicker-engine.ts"

/** Active-play calibration target (see scripts/playtime-sim.ts and docs/playtime-7h-balance.md). */
const TARGET_WORLDLINES = 8

test("playtime calibration tables match transcendence count", () => {
  assert.equal(config.transcendence.length, TARGET_WORLDLINES)
  assert.equal(config.rebirthGoalStretch?.length, TARGET_WORLDLINES)
  assert.ok((config.rebirthGoalScale?.length ?? 0) >= TARGET_WORLDLINES)
})

test("Core Heart opens only after every worldline buff is walked", () => {
  const heart = config.regions.find((r) => r.boss)
  assert.ok(heart)
  assert.equal(heart.requiresRebirths, TARGET_WORLDLINES)
  assert.ok(heart.boss && heart.boss.hp > 0)
})

test("rebirth requirement uses worldline 0 goal × stretch", () => {
  const meta = createInitialMeta()
  const first = worldlineGoal(config, 0) * (config.rebirthGoalStretch?.[0] ?? 1)
  assert.equal(rebirthRequirement(meta, config), first)
  assert.ok(first > config.rebirthEnergy)
})
