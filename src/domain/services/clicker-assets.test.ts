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

test("hoard instability is capped when income is near zero", async () => {
  const { hoardInstabilityPerSecond, HOARD_MAX_RATE } = await import("./clicker-engine.ts")
  const run = { coreEnergy: 1e12, regionCurrency: {} } as unknown as Parameters<typeof hoardInstabilityPerSecond>[0]
  assert.equal(hoardInstabilityPerSecond(run, 0), HOARD_MAX_RATE)
})

test("every world (home included) has an entry video and a landing still on disk", async () => {
  const { existsSync } = await import("node:fs")
  const { clickerConfig } = await import("../../data/clicker/catalog.ts")
  for (const region of clickerConfig.regions) {
    assert.ok(region.intro, `${region.id} has no intro`)
    for (const path of [region.intro.video, region.intro.still]) {
      assert.ok(existsSync(`public${path}`), `${region.id}: missing ${path}`)
    }
  }
})
