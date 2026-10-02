import assert from "node:assert/strict"
import test from "node:test"
import { clickerConfig as config } from "../../data/clicker/catalog.ts"
import {
  activateSkill,
  buyActiveSkillItem,
  buyProducer,
  createInitialMeta,
  createInitialRun,
  createInitialSave,
  grantAdminEnergy,
  processClick,
  processTick,
  productionSnapshot,
  sanitizeSave,
  startFever,
} from "./clicker-engine.ts"
import { crossedMilestone, milestoneMultiplier, nextMilestone, PRODUCER_MILESTONES } from "./clicker-milestones.ts"
import {
  SKILL_TREE_COLOR,
  gaugeFeverUnlocked,
  isSpecialSkill,
  ownedActiveSkills,
  skillColor,
  skillNovaColor,
  skillTreeOf,
} from "./clicker-special-skills.ts"
import { coverPlacement, hitPose, idlePose } from "./clicker-monster-fit.ts"
import { frameState } from "../../application/clicker-monster-view.ts"

const NOW = 9_000_000
const skill = (id: string) => config.activeSkills.find((s) => s.id === id)!
const rebirths = (n: number) => ({ ...createInitialMeta(), rebirthCount: n })
const inMine = (run: ReturnType<typeof createInitialRun>) => ({ ...run, mineSessionEndsAt: NOW + 120_000 })

test("milestones double output at 10 / 25 / 50 / 100 / 200 owned", () => {
  assert.deepEqual([...PRODUCER_MILESTONES], [10, 25, 50, 100, 200])
  assert.equal(milestoneMultiplier(9), 1)
  assert.equal(milestoneMultiplier(10), 2)
  assert.equal(milestoneMultiplier(25), 4)
  assert.equal(milestoneMultiplier(200), 32)
  assert.equal(nextMilestone(10), 25)
  assert.equal(nextMilestone(200), null)
  assert.equal(crossedMilestone(9, 10), 10)
  assert.equal(crossedMilestone(10, 11), null)
  assert.equal(crossedMilestone(9, 30), 25)
})

test("a producer's rate follows its milestone multiplier", () => {
  const meta = createInitialMeta()
  const base = createInitialRun(NOW, meta, config)
  const lv = (n: number) => ({ ...base, producerLevels: { solar_node: n } })
  const r9 = productionSnapshot(lv(9), meta, config, NOW).byProducer.solar_node!
  const r10 = productionSnapshot(lv(10), meta, config, NOW).byProducer.solar_node!
  assert.ok(Math.abs(r10 / r9 - (10 / 9) * 2) < 1e-9)
})

test("skill colours live in one table and sort mining blue / production green", () => {
  assert.deepEqual(SKILL_TREE_COLOR.mining, { main: "#38A8FF", glow: "#7FD0FF" })
  assert.deepEqual(SKILL_TREE_COLOR.production, { main: "#3DDC84", glow: "#8DF0B4" })
  assert.equal(skillTreeOf(skill("seismic_wave")), "mining")
  assert.equal(skillTreeOf(skill("assembly_line")), "production")
  assert.equal(skillTreeOf(skill("laser_focus")), "mining") // shop skills follow the same rule
  assert.equal(skillTreeOf(skill("grid_boost")), "production")
  assert.equal(skillColor(skill("overclock_grid")).main, "#3DDC84")
  assert.equal(skillNovaColor(skill("seismic_wave"), 0.5), "rgb(56 168 255 / 0.5)")
})

test("special skills unlock by rebirth count, need no charges and are not sold in the shop", () => {
  const specials = config.activeSkills.filter(isSpecialSkill).map((s) => s.id)
  assert.deepEqual(specials.sort(), ["assembly_line", "core_overload", "fever_core", "overclock_grid", "overdrive", "pulse_burst", "seismic_wave", "time_freeze"])
  // The shop lists only non-special skills (buildActiveSkillShopViews filters isSpecialSkill).
  for (const id of specials) assert.ok(buyActiveSkillItem(grantAdminEnergy(createInitialRun(NOW, createInitialMeta(), config), 1e12), config, id).error, `${id} must not be sold`)

  const run = inMine(createInitialRun(NOW, createInitialMeta(), config))
  assert.ok(activateSkill(run, rebirths(0), config, "time_freeze", NOW).error, "time_freeze needs 2 rebirths")
  assert.equal(activateSkill(run, rebirths(0), config, "seismic_wave", NOW).error, undefined)
  assert.equal(activateSkill(run, rebirths(2), config, "time_freeze", NOW).error, undefined)
  assert.ok(buyActiveSkillItem(grantAdminEnergy(run, 1e12), config, "seismic_wave").error)
  assert.deepEqual(ownedActiveSkills(run, rebirths(0), config, NOW).map((s) => s.id).sort(), ["assembly_line", "overdrive", "seismic_wave"])
})

test("burst skills pay N strikes of click power; cooldown applies", () => {
  const meta = rebirths(3)
  const run = inMine(createInitialRun(NOW, meta, config))
  const used = activateSkill(run, meta, config, "core_overload", NOW)
  assert.equal(used.error, undefined)
  assert.ok(used.run.coreEnergy > run.coreEnergy)
  assert.ok(used.run.skillCooldowns.core_overload > 0)
  assert.ok(activateSkill(used.run, meta, config, "core_overload", NOW + 10).error)
})

test("overdrive and assembly line run as timed buffs", () => {
  const meta = rebirths(0)
  let run = inMine(createInitialRun(NOW, meta, config))
  run = activateSkill(run, meta, config, "assembly_line", NOW).run
  assert.equal(run.activeBuffs.length, 1)
  const withBuff = productionSnapshot({ ...run, producerLevels: { solar_node: 1 } }, meta, config, NOW + 1)
  const without = productionSnapshot({ ...run, activeBuffs: [], producerLevels: { solar_node: 1 } }, meta, config, NOW + 1)
  assert.ok(Math.abs(withBuff.perSecond / without.perSecond - 2) < 1e-9)
})

test("time stop holds the mine timer and instability while it runs", () => {
  const meta = rebirths(2)
  let run = inMine(createInitialRun(NOW, meta, config))
  run = { ...run, lastTickAt: NOW }
  const used = activateSkill(run, meta, config, "time_freeze", NOW)
  assert.equal(used.error, undefined)
  const before = used.run.mineSessionEndsAt - NOW
  const ticked = processTick({ ...used.run, lastTickAt: NOW }, meta, config, NOW + 1000).run
  // 1s later (one tick) the session still has (at least) the same time left.
  assert.ok(ticked.mineSessionEndsAt - (NOW + 1000) >= before - 1)
})

test("gauge FEVER needs the fever_core skill (first rebirth); potion FEVER does not", () => {
  const charged = (m: ReturnType<typeof rebirths>) => {
    const r = createInitialRun(NOW, m, config)
    return { ...r, fever: { ...r.fever, gauge: config.feverGaugeMax }, potions: { blue: 1 } }
  }
  assert.equal(gaugeFeverUnlocked(rebirths(0), config), false)
  assert.equal(gaugeFeverUnlocked(rebirths(1), config), true)
  assert.ok(startFever(charged(rebirths(0)), rebirths(0), config, "GAUGE", null).error)
  assert.equal(startFever(charged(rebirths(1)), rebirths(1), config, "GAUGE", null).error, undefined)
  assert.equal(startFever(charged(rebirths(0)), rebirths(0), config, "POTION", "blue").error, undefined)
})

test("FEVER is shorter, charges slower and cools down longer than before", () => {
  assert.equal(config.feverDuration, 12) // was 20
  assert.equal(config.feverGaugeFillScale, 0.5) // was 1× (no scale)
  assert.equal(config.feverCoolDown, 30) // was 2
  const fill = (m: ReturnType<typeof rebirths>) => {
    const run = createInitialRun(NOW, m, config)
    const rng = () => 0.99 // no crit
    return processClick(inMine(run), m, config, NOW, rng).run.fever.gauge
  }
  assert.equal(fill(rebirths(0)), 0, "locked: gauge does not fill")
  assert.ok(fill(rebirths(1)) > 0 && fill(rebirths(1)) <= 0.5 * 1.0001)
})

test("old saves (no new fields, shop skills, production) still load", () => {
  const legacy = createInitialSave(NOW, config) as unknown as Record<string, Record<string, unknown>>
  legacy.runState!.skillItems = { laser_focus: 2 }
  legacy.runState!.producerLevels = { solar_node: 12 }
  const loaded = sanitizeSave(legacy, config, NOW)
  assert.equal(loaded.runState.skillItems.laser_focus, 2)
  assert.equal(loaded.runState.producerLevels.solar_node, 12)
  const run = inMine(loaded.runState)
  assert.equal(activateSkill(run, loaded.metaState, config, "laser_focus", NOW).error, undefined)
  assert.ok(buyProducer(grantAdminEnergy(run, 1e9), loaded.metaState, config, "solar_node", 1).run.producerLevels.solar_node === 13)
})

test("monster cover-fit fills the viewport and motion is bounded", () => {
  const img = { w: 1920, h: 1080 }
  for (const vp of [{ w: 1366, h: 768 }, { w: 1440, h: 900 }, { w: 390, h: 844 }]) {
    const p = coverPlacement(img, vp)
    assert.ok(img.w * p.scale >= vp.w - 1e-9 && img.h * p.scale >= vp.h - 1e-9, "no letterbox")
    assert.ok(p.x <= 1e-9 && p.y <= 1e-9)
  }
  assert.ok(Math.abs(idlePose(3.3).dy) < 6.1)
  assert.deepEqual(hitPose(1), { dy: 0, scale: 1, rot: 0 })
  assert.ok(hitPose(0).scale < 1)
  const f = frameState(img, { w: 1366, h: 768 }, 1, null, true)
  assert.deepEqual(f.pose, { dy: 0, scale: 1, rot: 0 })
})
