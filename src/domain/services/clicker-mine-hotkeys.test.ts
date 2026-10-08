import assert from "node:assert/strict"
import test from "node:test"
import {
  minePotionHotkeyLabel,
  minePotionSlotFromKeyboard,
  mineSkillSlotFromKeyboard,
} from "./clicker-mine-hotkeys.ts"

test("mine skill hotkeys map Digit1–9 to slots 0–8", () => {
  assert.equal(mineSkillSlotFromKeyboard("Digit1"), 0)
  assert.equal(mineSkillSlotFromKeyboard("Digit9"), 8)
  assert.equal(mineSkillSlotFromKeyboard("Digit0"), null)
  assert.equal(mineSkillSlotFromKeyboard("KeyQ"), null)
})

test("mine potion hotkeys map Q row keys to slots in order", () => {
  assert.equal(minePotionSlotFromKeyboard("KeyQ"), 0)
  assert.equal(minePotionSlotFromKeyboard("KeyW"), 1)
  assert.equal(minePotionSlotFromKeyboard("KeyE"), 2)
  assert.equal(minePotionSlotFromKeyboard("Digit1"), null)
  assert.equal(minePotionHotkeyLabel(0), "Q")
  assert.equal(minePotionHotkeyLabel(4), "T")
})
