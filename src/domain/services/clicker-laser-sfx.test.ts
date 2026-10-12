import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import test from "node:test"
import { laserHitSamplePath, mineLaserHitKind } from "../../lib/clicker-sfx.ts"

test("mine manual strikes map to heavy or crit samples", () => {
  assert.equal(mineLaserHitKind(false), "heavy")
  assert.equal(mineLaserHitKind(true), "crit")
})

test("laser hit mp3 samples exist on disk", () => {
  for (const kind of ["light", "heavy", "crit"] as const) {
    const path = laserHitSamplePath(kind)
    assert.ok(existsSync(`public${path}`), kind)
  }
})
