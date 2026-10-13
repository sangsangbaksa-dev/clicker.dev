import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import test from "node:test"
import {
  REBIRTH_CHROME_WORLDLINE_IDS,
  RebirthPhaseArt,
  WORLDLINE_SELECT_CHROME_QUADRANT,
} from "../../data/clicker/rebirth-assets.ts"

test("worldline select painted art exists on disk", () => {
  const paths = [
    RebirthPhaseArt.worldlineSelectBg,
    RebirthPhaseArt.selectChromeShared,
    RebirthPhaseArt.selectFocus,
    RebirthPhaseArt.selectLocked,
    RebirthPhaseArt.selectConfirmFlash,
  ]
  const missing = paths.filter((p) => !existsSync(`public${p}`))
  assert.deepEqual(missing, [])
})

test("Wave A worldlines map to chrome sheet quadrants", () => {
  for (const id of REBIRTH_CHROME_WORLDLINE_IDS) {
    assert.ok(WORLDLINE_SELECT_CHROME_QUADRANT[id], `${id} has chrome quadrant`)
  }
})
