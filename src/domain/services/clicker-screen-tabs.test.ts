import assert from "node:assert/strict"
import test from "node:test"
import { clickerConfig } from "../../data/clicker/catalog.ts"
import { createInitialSave, enterClickerMine } from "./clicker-engine.ts"
import {
  buildScreenTabs,
  selectScreenTab,
  shouldMountMineChamber,
  shouldShowManageScreen,
} from "./clicker-screen-tabs.ts"

const config = clickerConfig
const NOW = 2_000_000

test("buildScreenTabs omits rebirth until unlocked", () => {
  assert.deepEqual(buildScreenTabs({ showRebirth: false }).map((t) => t.id), ["mine", "upgrades", "skills", "shop"])
  assert.ok(buildScreenTabs({ showRebirth: true }).some((t) => t.id === "rebirth"))
})

test("selectScreenTab pauses when leaving mine and resumes when returning", () => {
  const save = enterClickerMine(createInitialSave(NOW, config), NOW, config).save
  const toShop = selectScreenTab(save, "mine", "shop", NOW + 1000)
  assert.equal(toShop.save.settings.playSurface, "hub")
  assert.ok(toShop.save.runState.minePausedRemainMs > 0)
  assert.equal(toShop.manageTab, "shop")
  const back = selectScreenTab(toShop.save, "shop", "mine", NOW + 5000)
  assert.equal(back.save.settings.playSurface, "mine")
  assert.equal(back.save.runState.minePausedRemainMs, 0)
})

test("shouldMountMineChamber only on mine tab with live session", () => {
  const save = enterClickerMine(createInitialSave(NOW, config), NOW, config).save
  assert.equal(shouldMountMineChamber("mine", save, NOW + 1), true)
  assert.equal(shouldMountMineChamber("shop", save, NOW + 1), false)
  const paused = selectScreenTab(save, "mine", "upgrades", NOW + 1000).save
  assert.equal(shouldMountMineChamber("mine", paused, NOW + 2000), false)
})

test("manage screens are exclusive to upgrade shop rebirth tabs", () => {
  assert.equal(shouldShowManageScreen("upgrades"), true)
  assert.equal(shouldShowManageScreen("mine"), false)
  assert.equal(shouldShowManageScreen("skills"), false)
})
