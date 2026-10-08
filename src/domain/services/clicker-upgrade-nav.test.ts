import assert from "node:assert/strict"
import test from "node:test"
import {
  UPGRADE_NAV_TABS,
  buildUpgradeNavTabs,
  stageStationFor,
  upgradeNavAction,
  upgradeNavLabel,
} from "./clicker-upgrade-nav.ts"

const base = { inMine: false, isHome: false, hasBoss: false, huntMode: false, hasMonster: false }

test("seven tabs in the requested order with unique ids and orders", () => {
  const tabs = buildUpgradeNavTabs({ station: "mine", rebirthVisible: true })
  assert.deepEqual(
    tabs.map((t) => t.label),
    ["채굴", "생산", "FEVER", "유틸", "몬스터", "환생", "코어 시추"],
  )
  assert.equal(new Set(UPGRADE_NAV_TABS.map((t) => t.id)).size, 7)
  assert.equal(new Set(UPGRADE_NAV_TABS.map((t) => t.order)).size, 7)
  assert.deepEqual(tabs.map((t) => t.order), [0, 1, 2, 3, 4, 5, 6])
})

test("category tabs are always enabled and filter", () => {
  const tabs = buildUpgradeNavTabs({ station: "mine", rebirthVisible: false })
  assert.ok(tabs.slice(0, 4).every((t) => t.enabled && t.kind === "category"))
  assert.deepEqual(upgradeNavAction("FEVER"), { kind: "filter", category: "FEVER" })
})

test("stageStationFor mirrors the hub stage branches", () => {
  assert.equal(stageStationFor({ ...base, inMine: true }), "mine")
  assert.equal(stageStationFor({ ...base, isHome: true }), "mine")
  assert.equal(stageStationFor({ ...base, hasBoss: true, hasMonster: true }), "boss")
  assert.equal(stageStationFor({ ...base, huntMode: true, hasMonster: true }), "hunt")
  assert.equal(stageStationFor({ ...base, huntMode: true }), "drill")
  assert.equal(stageStationFor(base), "drill")
})

test("monster and drill pills depend on the stage; rebirth on unlock", () => {
  const byId = (s: Parameters<typeof buildUpgradeNavTabs>[0]) => Object.fromEntries(buildUpgradeNavTabs(s).map((t) => [t.id, t]))
  const hunt = byId({ station: "hunt", rebirthVisible: false })
  assert.equal(hunt.MONSTER!.enabled, true)
  assert.equal(hunt.DRILL!.enabled, false)
  assert.ok(hunt.DRILL!.disabledReason)
  assert.equal(hunt.REBIRTH!.enabled, false)
  const drill = byId({ station: "drill", rebirthVisible: true })
  assert.equal(drill.DRILL!.enabled, true)
  assert.equal(drill.MONSTER!.enabled, false)
  assert.equal(drill.REBIRTH!.enabled, true)
  assert.equal(byId({ station: "boss", rebirthVisible: true }).MONSTER!.enabled, true)
})

test("route actions and label helper", () => {
  assert.deepEqual(upgradeNavAction("MONSTER"), { kind: "open-stage" })
  assert.deepEqual(upgradeNavAction("DRILL"), { kind: "open-stage" })
  assert.deepEqual(upgradeNavAction("REBIRTH"), { kind: "open-rebirth" })
  assert.equal(upgradeNavLabel({ label: "코어 시추" }), "코어 시추")
  assert.equal(upgradeNavLabel({ label: "코어 시추", shortLabel: "시추" }), "시추")
})
