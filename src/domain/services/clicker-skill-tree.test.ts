import assert from "node:assert/strict"
import test from "node:test"
import { clickerConfig as config } from "../../data/clicker/catalog.ts"
import { SKILL_TREE_LAYOUT } from "../../data/clicker/skill-tree-layout.ts"
import {
  applyRebirth,
  buySkillNode,
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

test("skill graph: unique ids, known prereqs, tier never below a prereq, every node laid out", () => {
  const ids = new Set(config.skillNodes.map((n) => n.id))
  assert.equal(ids.size, config.skillNodes.length)
  const byId = new Map(config.skillNodes.map((n) => [n.id, n]))
  for (const node of config.skillNodes) {
    assert.ok(SKILL_TREE_LAYOUT[node.id], `layout missing for ${node.id}`)
    assert.ok(node.tier >= 1 && node.tier <= 5, node.id)
    for (const req of node.requires ?? []) {
      const parent = byId.get(req)
      assert.ok(parent, `${node.id} requires unknown ${req}`)
      assert.equal(parent.branch, node.branch, `${node.id} crosses branches`)
      assert.ok(parent.tier <= node.tier, `${node.id} tier below ${req}`)
      assert.ok(parent.cost <= node.cost, `${node.id} cheaper than ${req}`)
    }
  }
  for (const branch of ["FOCUS", "AUTOMATION", "RESONANCE", "TRANSCENDENCE"]) {
    assert.ok(config.skillNodes.some((n) => n.branch === branch && n.tier === 5), `${branch} has no capstone`)
  }
})

test("tagged production nodes only boost producers with that tag", () => {
  const base = ownAll([])
  base.run = { ...base.run, producerLevels: { ...base.run.producerLevels, solar_node: 10, pulse_relay: 10 } }
  const before = productionSnapshot(base.run, base.meta, config, base.now)
  const after = productionSnapshot({ ...base.run, ownedSkillNodeIds: ["auto_early"] }, base.meta, config, base.now)
  assert.equal(after.byProducer.solar_node, before.byProducer.solar_node * 2)
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
  assert.equal(reborn.run.coreEnergy, 50)
  assert.deepEqual(reborn.run.ownedSkillNodeIds, [])
})
