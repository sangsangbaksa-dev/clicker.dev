import assert from "node:assert/strict"
import test from "node:test"
import type { MetaState } from "../entities/clicker.ts"
import {
  activeMineWorldlineThemeId,
  mineWorldlineTheme,
  mineWorldlineThemeCssVars,
} from "./clicker-mine-worldline-theme.ts"

const meta = (ids: string[]): MetaState =>
  ({
    transcendenceIds: ids,
    rebirthCount: ids.length,
  }) as MetaState

test("active theme is origin before any transcendence", () => {
  assert.equal(activeMineWorldlineThemeId(meta([])), "origin")
})

test("active theme follows the most recently walked transcendence", () => {
  assert.equal(activeMineWorldlineThemeId(meta(["focus_line"])), "focus_line")
  assert.equal(activeMineWorldlineThemeId(meta(["focus_line", "auto_line"])), "auto_line")
})

test("unknown transcendence id falls back to origin theme", () => {
  assert.equal(activeMineWorldlineThemeId(meta(["not_a_line"])), "origin")
  assert.equal(mineWorldlineTheme("origin").accent, mineWorldlineTheme(activeMineWorldlineThemeId(meta(["not_a_line"]))).accent)
})

test("css vars expose accent and plate tuning", () => {
  const t = mineWorldlineTheme("reso_line")
  const vars = mineWorldlineThemeCssVars(t)
  assert.equal(vars["--mine-accent"], "#FF4DDC")
  assert.match(vars["--mine-plate-hue"], /deg$/)
})
