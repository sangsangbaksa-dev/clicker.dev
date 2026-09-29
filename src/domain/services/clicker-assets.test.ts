import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import test from "node:test"
import { clickerConfig } from "../../data/clicker/catalog.ts"

test("every catalog image path points at a real file in public/", () => {
  const paths = new Set<string>()
  const walk = (v: unknown) => {
    if (typeof v === "string") {
      if (/^\/clicker\/.+\.(webp|png|jpe?g)$/.test(v)) paths.add(v)
    } else if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === "object") Object.values(v).forEach(walk)
  }
  walk(clickerConfig)
  const missing = [...paths].filter((p) => !existsSync(`public${p}`))
  assert.deepEqual(missing, [])
})
