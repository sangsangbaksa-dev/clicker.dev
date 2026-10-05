import assert from "node:assert/strict"
import test from "node:test"
import {
  createCenterOre,
  MAX_ORE_NODES,
  oreHitBox,
  oreStrikePoint,
  SINGLE_CENTER_POSITION,
  spawnMineOres,
} from "./ore-node.ts"

test("createCenterOre places one node at the single center position", () => {
  const ore = createCenterOre()
  assert.equal(ore.id, "core-center")
  assert.equal(ore.x, SINGLE_CENTER_POSITION.x)
  assert.equal(ore.y, SINGLE_CENTER_POSITION.y)
})

test("oreStrikePoint and oreHitBox use normalized coordinates", () => {
  const ore = createCenterOre()
  assert.deepEqual(oreStrikePoint(ore, 1000, 800), { x: 500, y: 416 })
  const box = oreHitBox(ore, 1000, 800)
  assert.ok(box.width > 0)
  assert.equal(box.left + box.width / 2, 500)
  assert.equal(box.top + box.height / 2, 416)
})

test("MAX_ORE_NODES caps a single center spawn", () => {
  assert.equal(MAX_ORE_NODES, 1)
})

test("spawnMineOres returns exactly one center node", () => {
  const nodes = spawnMineOres()
  assert.equal(nodes.length, 1)
  assert.equal(nodes[0]!.id, "core-center")
  assert.equal(nodes[0]!.x, SINGLE_CENTER_POSITION.x)
  assert.equal(nodes[0]!.y, SINGLE_CENTER_POSITION.y)
})
