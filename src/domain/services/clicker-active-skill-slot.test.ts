import assert from "node:assert/strict"
import test from "node:test"
import {
  activeSkillBarHint,
  activeSkillBarShortLabel,
  activeSkillBarStatusLine,
  isActiveSkillBarDisabled,
  resolveActiveSkillBarState,
} from "./clicker-active-skill-slot.ts"

test("resolve: crisis beats cooldown and empty", () => {
  assert.equal(resolveActiveSkillBarState({ crisisActive: true, cooldownMs: 5, charges: 0 }), "crisis")
})

test("resolve: cooldown beats empty", () => {
  assert.equal(resolveActiveSkillBarState({ crisisActive: false, cooldownMs: 1, charges: 0 }), "cooldown")
})

test("resolve: zero charges is empty when ready to cast", () => {
  assert.equal(resolveActiveSkillBarState({ crisisActive: false, cooldownMs: 0, charges: 0 }), "empty")
  assert.equal(resolveActiveSkillBarState({ crisisActive: false, cooldownMs: 0, charges: 2 }), "ready")
})

test("disabled when crisis, cooldown, or empty", () => {
  assert.equal(isActiveSkillBarDisabled("ready"), false)
  assert.equal(isActiveSkillBarDisabled("empty"), true)
})

test("labels match empty patch copy", () => {
  assert.equal(activeSkillBarStatusLine("empty", 0), "0 · 없음")
  assert.equal(activeSkillBarShortLabel("empty"), "없음")
  assert.equal(activeSkillBarHint("empty"), "충전 없음 · 상점에서 충전")
})
