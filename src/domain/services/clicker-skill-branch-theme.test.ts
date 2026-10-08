import assert from "node:assert/strict"
import test from "node:test"
import {
  SKILL_BRANCH_COLOR,
  SKILL_BRANCH_ORDER,
  SKILL_BRANCH_THEMES,
  purchaseFxAccent,
  skillBranchAccent,
} from "./clicker-skill-branch-theme.ts"

test("skill branch theme: five distinct accents, automation is green production", () => {
  assert.equal(SKILL_BRANCH_THEMES.length, 5)
  assert.equal(SKILL_BRANCH_ORDER.length, 5)
  const accents = SKILL_BRANCH_THEMES.map((t) => t.accent)
  assert.equal(new Set(accents).size, 5, "branch accents must be unique")
  const auto = skillBranchAccent("AUTOMATION")
  assert.match(auto, /^#[0-9a-f]{6}$/i)
  const { r, g, b } = hexRgb(auto)
  assert.ok(g > r && g > b, "AUTOMATION accent should read as green")
  assert.ok(g >= 0x80, "AUTOMATION green should be vivid enough for UI")
})

test("purchaseFxAccent maps upgrade categories to branch hues", () => {
  assert.equal(purchaseFxAccent("PRODUCTION"), SKILL_BRANCH_COLOR.AUTOMATION)
  assert.equal(purchaseFxAccent("CLICK"), SKILL_BRANCH_COLOR.FOCUS)
  assert.equal(purchaseFxAccent("automation"), SKILL_BRANCH_COLOR.AUTOMATION)
})

function hexRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "")
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}
