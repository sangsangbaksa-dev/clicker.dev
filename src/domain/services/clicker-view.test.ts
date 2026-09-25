import assert from "node:assert/strict"
import test from "node:test"
import { clickerConfig } from "../../data/clicker/catalog.ts"
import type { RunState } from "../entities/clicker.ts"
import { createInitialMeta, createInitialRun, maxAffordable, scaledCost } from "./clicker-engine.ts"
import {
  bulkAffordable,
  buildHud,
  buildPotionShopViews,
  buildProducerViews,
  buildRegionViews,
  buildSkillNodeViews,
  buildUpgradeViews,
} from "./clicker-view.ts"

const config = clickerConfig
const now = 5_000_000
const meta = createInitialMeta()

function run(patch: Partial<RunState> = {}): RunState {
  return { ...createInitialRun(now, meta, config), ...patch }
}

test("a fresh run reads calm: idle core, stable instability, no combo text", () => {
  const hud = buildHud(run(), meta, config, now)
  assert.equal(hud.coreVisual, "idle")
  assert.equal(hud.instability.label, "안정")
  assert.equal(hud.comboText, "")
  assert.equal(hud.fever.active, false)
  assert.equal(hud.canRebirth, false)
  assert.ok(hud.currentGoal.ratio >= 0 && hud.currentGoal.ratio <= 1)
})

test("instability labels step up with the engine's levels and 90+ shows the crisis core", () => {
  const label = (instability: number) => buildHud(run({ instability }), meta, config, now).instability.label
  assert.equal(label(39), "안정")
  assert.equal(label(40), "경고")
  assert.equal(label(70), "위험")
  assert.equal(label(100), "위기")
  assert.equal(buildHud(run({ instability: 89 }), meta, config, now).coreVisual, "idle")
  assert.equal(buildHud(run({ instability: 90 }), meta, config, now).coreVisual, "crisis")
  assert.equal(buildHud(run({ crisisActive: true }), meta, config, now).coreVisual, "crisis")
})

test("fever progress follows the phase: gauge, then time left, then cool-down", () => {
  const base = run()
  const gauge = buildHud(
    run({ fever: { ...base.fever, gauge: config.feverGaugeMax / 2 } }),
    meta,
    config,
    now,
  ).fever
  assert.equal(gauge.progress, 0.5)
  assert.equal(gauge.ready, false)

  const ready = buildHud(run({ fever: { ...base.fever, gauge: config.feverGaugeMax } }), meta, config, now).fever
  assert.equal(ready.ready, true)
  assert.equal(ready.phaseLabel, "FEVER 준비")

  const on = buildHud(
    run({ fever: { ...base.fever, phase: "FEVER", duration: 10, remainingTime: 2.5, combo: 3 } }),
    meta,
    config,
    now,
  )
  assert.equal(on.fever.active, true)
  assert.equal(on.fever.progress, 0.25)
  assert.equal(on.fever.phaseLabel, "FEVER ×3")
  assert.equal(on.coreVisual, "fever")

  const cooling = buildHud(
    run({ fever: { ...base.fever, phase: "COOL_DOWN", remainingTime: config.feverCoolDown } }),
    meta,
    config,
    now,
  ).fever
  assert.equal(cooling.phaseLabel, "쿨다운")
  assert.equal(cooling.progress, 1)
})

test("combo text shows only from the second hit, with time left", () => {
  const base = run()
  const hud = buildHud(run({ combo: { ...base.combo, count: 3, expiresAt: now + 1500 } }), meta, config, now)
  assert.equal(hud.comboText, "콤보 ×3")
  assert.equal(hud.comboRemainText, "남음 1.5초")
})

test("producers can be bought only when unlocked and affordable", () => {
  const first = config.producers[0]
  const cost = scaledCost(run(), first.baseCost)
  const poor = buildProducerViews(run({ coreEnergy: 0 }), meta, config, now).find((p) => p.id === first.id)!
  const rich = buildProducerViews(run({ coreEnergy: cost }), meta, config, now).find((p) => p.id === first.id)!
  assert.equal(poor.canBuy, false)
  assert.equal(rich.canBuy, rich.unlocked)
  if (poor.unlocked) assert.equal(poor.lockReason, "CORE 부족")
  for (const view of buildProducerViews(run({ coreEnergy: 0 }), meta, config, now)) {
    if (!view.unlocked) assert.match(view.lockReason, /CORE 해금$/)
  }
})

test("bulk MAX is affordable exactly when at least one level is", () => {
  const first = config.producers[0].id
  for (const coreEnergy of [0, 1, 1e3, 1e6, 1e12]) {
    const r = run({ coreEnergy })
    const views = buildProducerViews(r, meta, config, now)
    if (!views.find((v) => v.id === first)!.unlocked) continue
    const expected = maxAffordable(config, first, 0, coreEnergy, r.costScale) >= 1
    assert.equal(bulkAffordable(r, config, first, "MAX"), expected, `coreEnergy ${coreEnergy}`)
    assert.equal(bulkAffordable(r, config, first, 1), expected, `coreEnergy ${coreEnergy}`)
  }
})

test("upgrade status: owned beats locked beats too poor", () => {
  const gated = config.upgrades.find((u) => u.unlockProducerId)
  assert.ok(gated, "catalog has a producer-gated upgrade")
  const locked = buildUpgradeViews(run({ coreEnergy: 1e30 }), config).find((u) => u.id === gated.id)!
  assert.equal(locked.status, "LOCKED")
  const owned = buildUpgradeViews(run({ ownedUpgradeIds: [gated.id] }), config).find((u) => u.id === gated.id)!
  assert.equal(owned.status, "OWNED")
  const poor = buildUpgradeViews(
    run({ coreEnergy: 0, producerLevels: { [gated.unlockProducerId!]: 1 } }),
    config,
  ).find((u) => u.id === gated.id)!
  assert.equal(poor.status, "POOR")
})

test("a skill node stays locked until every prerequisite is owned", () => {
  const child = config.skillNodes.find((n) => (n.requires ?? []).length > 0)
  assert.ok(child, "catalog has a node with prerequisites")
  const rich = { coreEnergy: 1e30 }
  const before = buildSkillNodeViews(run(rich), config).find((n) => n.id === child.id)!
  assert.equal(before.status, "LOCKED")
  assert.equal(before.canBuy, false)
  const after = buildSkillNodeViews(run({ ...rich, ownedSkillNodeIds: [...child.requires!] }), config).find(
    (n) => n.id === child.id,
  )!
  assert.equal(after.status, "AVAILABLE")
  assert.equal(after.canBuy, true)
})

test("the potion shop lists cheapest first", () => {
  const costs = buildPotionShopViews(run(), config).map((p) => config.potions.find((c) => c.id === p.id)!.shopCost)
  assert.deepEqual(costs, [...costs].sort((a, b) => a - b))
})

test("regions: home is open from the start, others unlock by lifetime CORE", () => {
  const fresh = buildRegionViews(run(), config, now)
  const home = fresh.find((r) => r.isHome)!
  assert.equal(home.unlocked, true)
  assert.equal(home.isCurrent, true)
  const far = config.regions.find((r) => !r.isHome && r.unlockAtLifetimeEnergy > 0)!
  assert.equal(fresh.find((r) => r.id === far.id)!.unlocked, false)
  const threshold = scaledCost(run(), far.unlockAtLifetimeEnergy)
  const later = buildRegionViews(run({ lifetimeCoreEnergy: threshold }), config, now)
  const opened = later.find((r) => r.id === far.id)!
  assert.equal(opened.unlocked, true)
  assert.equal(opened.unlockText, "해금됨")
})
