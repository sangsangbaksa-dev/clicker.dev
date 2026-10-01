import assert from "node:assert/strict"
import test from "node:test"
import { spawnMineOres } from "./spawn-mine-ores.ts"
import { SINGLE_CENTER_POSITION } from "../domain/services/ore-node.ts"

test("spawnMineOres returns exactly one center node", () => {
  const nodes = spawnMineOres()
  assert.equal(nodes.length, 1)
  assert.equal(nodes[0]!.id, "core-center")
  assert.equal(nodes[0]!.x, SINGLE_CENTER_POSITION.x)
  assert.equal(nodes[0]!.y, SINGLE_CENTER_POSITION.y)
})
