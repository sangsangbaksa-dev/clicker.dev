import assert from "node:assert/strict"
import test from "node:test"
import { clickerConfig as config } from "../../data/clicker/catalog.ts"
import { createInitialSave } from "./clicker-engine.ts"
import { buildHud, buildProducerViews } from "./clicker-view.ts"

const NOW = 20_000_000

test("fresh save HUD is idle, stable and not rebirth-ready", () => {
  const save = createInitialSave(NOW, config)
  const hud = buildHud(save.runState, save.metaState, config, NOW)
  assert.equal(hud.coreVisual, "idle")
  assert.equal(hud.instability.label, "안정")
  assert.equal(hud.canRebirth, false)
  assert.equal(hud.fever.active, false)
  assert.equal(hud.comboText, "")
  assert.ok(hud.currentGoal.ratio >= 0 && hud.currentGoal.ratio <= 1)
})

test("high instability flips the core visual to crisis", () => {
  const save = createInitialSave(NOW, config)
  const run = { ...save.runState, instability: 95 }
  assert.equal(buildHud(run, save.metaState, config, NOW).coreVisual, "crisis")
})

test("combo text only appears past one hit", () => {
  const save = createInitialSave(NOW, config)
  const run = { ...save.runState, combo: { ...save.runState.combo, count: 5, expiresAt: NOW + 2000 } }
  const hud = buildHud(run, save.metaState, config, NOW)
  assert.equal(hud.comboText, "콤보 ×5")
  assert.equal(hud.comboRemainText, "남음 2.0초")
})

test("producer views list every producer with shares in 0–1", () => {
  const save = createInitialSave(NOW, config)
  const views = buildProducerViews(save.runState, save.metaState, config, NOW)
  assert.equal(views.length, config.producers.length)
  for (const v of views) assert.ok(v.share >= 0 && v.share <= 1)
})
