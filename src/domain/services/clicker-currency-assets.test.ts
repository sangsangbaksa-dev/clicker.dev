import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import test from "node:test"
import { CLICKER_REGIONS } from "../../data/clicker/regions.ts"

test("region currency webp icons exist for every currency region", () => {
  const missing = CLICKER_REGIONS.filter((r) => r.currency).map((r) => `/clicker/currency/${r.id}.webp`).filter((p) => !existsSync(`public${p}`))
  assert.deepEqual(missing, [])
})
