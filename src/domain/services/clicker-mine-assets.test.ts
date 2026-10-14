import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import test from "node:test"
import { MineArt, MINE_ORE_PLATE, MINE_SESSION_WARM_ART } from "../../data/clicker/mine-assets.ts"

test("mine art pack paths exist on disk", () => {
  const paths = new Set<string>(Object.values(MineArt))
  paths.add(MINE_ORE_PLATE.src)
  const missing = [...paths].filter((p) => !existsSync(`public${p}`))
  assert.deepEqual(missing, [])
})

test("hi-tech chamber plate matches door-walk landing dimensions", () => {
  assert.equal(MINE_ORE_PLATE.width, 1920)
  assert.equal(MINE_ORE_PLATE.height, 1080)
  assert.equal(MineArt.chamberInteriorMineral1080pV1.endsWith(".webp"), true)
})

test("mine session warm list paths exist on disk", () => {
  const missing = MINE_SESSION_WARM_ART.filter((p) => !existsSync(`public${p}`))
  assert.deepEqual(missing, [])
})
