import assert from "node:assert/strict"
import { existsSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { CLICKER_ASSETS } from "../../data/clicker/catalog.ts"
import { CLICKER_TUTORIAL_STEPS } from "../../data/clicker/onboarding.ts"

const PUBLIC = join(import.meta.dirname, "../../../public")

/** Story plates that must stay unique to the tutorial (login / loading / hub keep the old files). */
const REPLACED = {
  dawn: "/clicker/bg/tutorial_story_dawn_aurelia_v1.webp",
  wake: "/clicker/bg/tutorial_story_wake_outpost_v1.webp",
  voice: "/clicker/bg/tutorial_story_voice_vein_v1.webp",
} as const

function loginBackground(): string {
  const src = readFileSync(join(import.meta.dirname, "../../components/clicker/clicker-login-gate.tsx"), "utf8")
  const match = src.match(/const LOGIN_BG = "([^"]+)"/)
  assert.ok(match, "login gate background constant")
  return match[1]
}

/** Backgrounds a first-run player already sees before or under the tutorial. */
function screenBackgrounds(): string[] {
  return [loginBackground(), CLICKER_ASSETS.bgLoading, CLICKER_ASSETS.bgChamber, CLICKER_ASSETS.bgMineEntrance]
}

test("tutorial story plates exist and do not reuse another step or a login, loading, or hub background", () => {
  const plates = CLICKER_TUTORIAL_STEPS.filter((step) => step.bgAssetId)
  assert.equal(plates.length, 9)

  const missing = plates
    .map((step) => step.bgAssetId as string)
    .filter((path) => {
      const file = join(PUBLIC, path)
      return !existsSync(file) || statSync(file).size < 10_000
    })
  assert.deepEqual(missing, [])

  const paths = plates.map((step) => step.bgAssetId)
  assert.equal(new Set(paths).size, paths.length, "tutorial steps must not share a plate")

  const reserved = new Set(screenBackgrounds())
  const shared = plates.filter((step) => reserved.has(step.bgAssetId as string)).map((step) => `${step.id}:${step.bgAssetId}`)
  assert.deepEqual(shared, [])

  for (const [id, path] of Object.entries(REPLACED)) {
    assert.equal(plates.find((step) => step.id === id)?.bgAssetId, path)
  }

  assert.equal(loginBackground(), "/clicker/bg/login_core_sanctum.webp")
  assert.equal(CLICKER_ASSETS.bgLoading, "/clicker/bg/loading_core_awakening.webp")
  assert.equal(CLICKER_ASSETS.bgChamber, "/clicker/bg/region_core_chamber.webp")
  for (const path of screenBackgrounds()) {
    assert.ok(existsSync(join(PUBLIC, path)) && statSync(join(PUBLIC, path)).size > 10_000, path)
  }
})
