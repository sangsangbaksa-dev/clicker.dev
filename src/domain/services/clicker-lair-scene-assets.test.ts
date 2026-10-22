import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import test from "node:test"

/** Portrait + wide cuts for each lair boss (kept in sync with `BOSS_SCENES` in clicker-boss-scene). */
const LAIR_BOSS_SCENE_PATHS = [
  "/clicker/boss/storm_spire.webp",
  "/clicker/boss/storm_spire_wide.webp",
  "/clicker/boss/phase_vault.webp",
  "/clicker/boss/phase_vault_wide.webp",
  "/clicker/boss/deep_fault.webp",
  "/clicker/boss/deep_fault_wide.webp",
] as const

test("lair boss scene art exists on disk", () => {
  const missing = LAIR_BOSS_SCENE_PATHS.filter((p) => !existsSync(`public${p}`))
  assert.deepEqual(missing, [])
})
