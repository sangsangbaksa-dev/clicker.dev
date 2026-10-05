import assert from "node:assert/strict"
import test from "node:test"
import { clickerConfig as config } from "../../data/clicker/catalog.ts"
import { buyProducer, createInitialSave, grantAdminEnergy } from "./clicker-engine.ts"
import { buildHud, buildProducerViews, buildSkillNodeViews, skillStatusLabel } from "./clicker-view.ts"

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

test("first Solar Node shows its real rate, not +0", () => {
  const save = createInitialSave(NOW, config)
  const run = buyProducer(grantAdminEnergy(save.runState, 10), save.metaState, config, "solar_node", 1).run
  assert.equal(buildHud(run, save.metaState, config, NOW).productionPerSecondText, "+0.003/s")
  const row = buildProducerViews(run, save.metaState, config, NOW).find((v) => v.id === "solar_node")!
  assert.equal(row.productionText, "+0.003 / sec")
})

test("skill map labels a node behind an unowned prerequisite as locked, not unlockable", () => {
  const save = createInitialSave(NOW, config)
  const nodes = buildSkillNodeViews(save.runState, config)
  const finale = nodes.find((n) => n.status === "LOCKED")!
  assert.ok(finale, "a fresh save has locked circuits")
  assert.equal(skillStatusLabel(finale.status), "잠김")
  assert.equal(skillStatusLabel("AVAILABLE"), "해금 가능")
  assert.equal(skillStatusLabel("POOR"), "CORE 부족")
  assert.equal(skillStatusLabel("OWNED"), "활성")
})
