import assert from "node:assert/strict"
import test from "node:test"
import { clickerConfig as config } from "../../data/clicker/catalog.ts"
import { layoutSkillTree, connectorPath, SKILL_FINAL_NODE_ID } from "../../data/clicker/skill-tree-layout.ts"
import {
  applyRebirth,
  buySkillNode,
  droneEnergyPerSecond,
  isSkillNodeVisible,
  processTick,
  createInitialMeta,
  createInitialRun,
  grantAdminEnergy,
  processClick,
  productionSnapshot,
} from "./clicker-engine.ts"

const rng = () => 0.99

function ownAll(ids: string[]) {
  const now = 1_000_000
  const meta = createInitialMeta()
  const run = { ...createInitialRun(now, meta, config), ownedSkillNodeIds: ids }
  return { now, meta, run }
}

test("skill graph: 130+ unique nodes, known prereqs, tier never below a prereq, every node laid out", () => {
  const ids = new Set(config.skillNodes.map((n) => n.id))
  assert.equal(ids.size, config.skillNodes.length)
  assert.ok(config.skillNodes.length >= 130 && config.skillNodes.length <= 160)
  const byId = new Map(config.skillNodes.map((n) => [n.id, n]))
  const layout = layoutSkillTree(config.skillNodes)
  const placed: Array<{ col: number; row: number }> = [layout.hub]
  for (const node of config.skillNodes) {
    const cell = layout.cells[node.id]
    assert.ok(cell, `layout missing for ${node.id}`)
    if (node.id === layout.centerId) continue
    for (const other of placed) assert.ok(Math.hypot(other.col - cell.col, other.row - cell.row) > 1, `${node.id} overlaps another node`)
    placed.push(cell)
    assert.ok(node.tier >= 1 && node.tier <= 5, node.id)
    for (const req of node.requires ?? []) {
      const parent = byId.get(req)
      assert.ok(parent, `${node.id} requires unknown ${req}`)
      assert.equal(parent.branch, node.branch, `${node.id} crosses branches`)
      assert.ok(parent.tier <= node.tier, `${node.id} tier below ${req}`)
      assert.ok(parent.cost <= node.cost, `${node.id} cheaper than ${req}`)
    }
  }
  for (const branch of ["FOCUS", "AUTOMATION", "RESONANCE", "TRANSCENDENCE", "HUNT"]) {
    assert.ok(config.skillNodes.some((n) => n.branch === branch && n.tier === 5), `${branch} has no capstone`)
  }
})

test("skill map: branch roots form a regular pentagon and the final upgrade sits on the hub", () => {
  const layout = layoutSkillTree(config.skillNodes)
  assert.equal(layout.centerId, SKILL_FINAL_NODE_ID)
  assert.deepEqual(layout.cells[SKILL_FINAL_NODE_ID], layout.hub)
  const roots = config.skillNodes.filter((n) => !n.requires?.length).map((n) => layout.cells[n.id])
  assert.equal(roots.length, 5)
  const polar = roots.map((c) => ({ r: Math.hypot(c.col - layout.hub.col, c.row - layout.hub.row), a: Math.atan2(c.row - layout.hub.row, c.col - layout.hub.col) }))
  for (const p of polar) assert.ok(Math.abs(p.r - polar[0].r) < 1e-9, "roots not equidistant from the hub")
  const angles = polar.map((p) => (p.a + 2 * Math.PI) % (2 * Math.PI)).sort((a, b) => a - b)
  for (let i = 0; i < 5; i++) {
    const gap = ((angles[(i + 1) % 5] - angles[i] + 2 * Math.PI) % (2 * Math.PI)) || 2 * Math.PI
    assert.ok(Math.abs(gap - (2 * Math.PI) / 5) < 1e-9, "roots not evenly spaced")
  }
})

test("tagged production nodes only boost producers with that tag", () => {
  const base = ownAll([])
  base.run = { ...base.run, producerLevels: { ...base.run.producerLevels, solar_node: 10, pulse_relay: 10 } }
  const before = productionSnapshot(base.run, base.meta, config, base.now)
  const after = productionSnapshot({ ...base.run, ownedSkillNodeIds: ["auto_early"] }, base.meta, config, base.now)
  const early = config.skillNodes.find((n) => n.id === "auto_early")!.productionMultiplier!
  assert.ok(early > 1)
  assert.ok(Math.abs(after.byProducer.solar_node / before.byProducer.solar_node - early) < 1e-9)
  assert.equal(after.byProducer.pulse_relay, before.byProducer.pulse_relay)
})

test("critical multiplier and combo cap nodes apply to clicks", () => {
  const plain = ownAll([])
  const lethal = ownAll(["focus_lethal"])
  const critRng = () => 0
  const a = processClick(plain.run, plain.meta, config, plain.now, critRng).result
  const b = processClick(lethal.run, lethal.meta, config, lethal.now, critRng).result
  assert.ok(a.isCritical && b.isCritical)
  assert.ok(Math.abs(b.energyGained / a.energyGained - 1.5) < 1e-9)
  const chained = processClick(ownAll(["focus_chain"]).run, plain.meta, config, plain.now, rng).run
  assert.equal(chained.combo.maxCombo, 35)
})

test("startingEnergy nodes carry CORE into the next run", () => {
  const now = 2_000_000
  const meta = createInitialMeta()
  let run = grantAdminEnergy(createInitialRun(now, meta, config), config.rebirthEnergy)
  run = buySkillNode(run, config, "trans_start").run
  const reborn = applyRebirth(run, meta, config, "focus_line", now + 1)
  assert.equal(reborn.error, undefined)
  // Carried CORE is paid at the new worldline's price level.
  assert.ok(Math.abs(reborn.run.coreEnergy - 0.05 * config.priceGrowth) < 1e-12)
  assert.deepEqual(reborn.run.ownedSkillNodeIds, [])
})

test("connectors are straight lines between circuits", () => {
  const layout = layoutSkillTree(config.skillNodes)
  for (const node of config.skillNodes) {
    const parents = (node.requires ?? []).map((id) => layout.cells[id])
    for (const parent of parents.length ? parents : [layout.hub]) {
      const d = connectorPath(parent, layout.cells[node.id])
      assert.match(d, /^M-?[\d.]+ -?[\d.]+L-?[\d.]+ -?[\d.]+$/, d)
    }
  }
})

test("a node stays hidden until every prerequisite is owned", () => {
  const node = (id: string) => config.skillNodes.find((n) => n.id === id)!
  const { run } = ownAll(["focus_pinpoint"])
  assert.equal(isSkillNodeVisible(run, node("focus_click")), true)
  assert.equal(isSkillNodeVisible(run, node("focus_crit")), false)
  assert.equal(isSkillNodeVisible(run, node("focus_breaker")), false, "needs focus_rhythm too")
  const both = { ...run, ownedSkillNodeIds: ["focus_pinpoint", "focus_rhythm"] }
  assert.equal(isSkillNodeVisible(both, node("focus_breaker")), true)
})

test("lightning, echo and shockwave add bonus hits", () => {
  const base = ownAll([])
  const plain = processClick(base.run, base.meta, config, base.now, rng).result.energyGained
  // rng 0 → crit, echo and lightning all fire; compare against a crit-only click.
  const zero = () => 0
  const critOnly = processClick(base.run, base.meta, config, base.now, zero).result.energyGained
  const storm = ownAll(["storm_spark", "echo_tap"])
  const r = processClick(storm.run, storm.meta, config, storm.now, zero).result
  assert.ok(r.lightning && r.echo)
  assert.ok(Math.abs(r.energyGained / critOnly - (1 + 1 + 3)) < 1e-9)
  const quake = ownAll(["quake_tremor"])
  const q = processClick({ ...quake.run, clickCount: 29 }, quake.meta, config, quake.now, rng).result
  assert.ok(q.quake)
  assert.ok(Math.abs(q.energyGained / plain - 6) < 1e-9)
  const miss = processClick({ ...quake.run, clickCount: 3 }, quake.meta, config, quake.now, rng).result
  assert.equal(miss.quake, false)
})

test("mining drones add CORE every tick", () => {
  const { now, meta, run } = ownAll(["drone_scout"])
  const rate = droneEnergyPerSecond(run, meta, config)
  assert.ok(rate > 0)
  const ticked = processTick({ ...run, lastTickAt: now }, meta, config, now + 1000).run
  assert.ok(Math.abs(ticked.coreEnergy - run.coreEnergy - rate) < 1e-6)
})
