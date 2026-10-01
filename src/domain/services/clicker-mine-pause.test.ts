import assert from "node:assert/strict"
import test from "node:test"
import { clickerConfig } from "../../data/clicker/catalog.ts"
import { createInitialSave, enterClickerMine } from "./clicker-engine.ts"
import {
  formatMinePauseBadge,
  isMinePaused,
  pauseMine,
  resumeMine,
} from "./clicker-mine-pause.ts"

const config = clickerConfig
const NOW = 1_000_000

test("pauseMine freezes remaining time and returns to hub without cooldown", () => {
  const save = createInitialSave(NOW, config)
  const entered = enterClickerMine(save, NOW, config).save
  const endsAt = entered.runState.mineSessionEndsAt
  const paused = pauseMine(entered, NOW + 4000)
  assert.equal(paused.settings.playSurface, "hub")
  assert.equal(paused.runState.mineSessionEndsAt, 0)
  assert.equal(paused.runState.minePausedRemainMs, endsAt - (NOW + 4000))
  assert.equal(paused.runState.mineCooldownUntil, entered.runState.mineCooldownUntil)
})

test("resumeMine restores session end and play surface", () => {
  const save = createInitialSave(NOW, config)
  const entered = enterClickerMine(save, NOW, config).save
  const paused = pauseMine(entered, NOW + 2000)
  const remain = paused.runState.minePausedRemainMs
  const resumed = resumeMine(paused, NOW + 9000)
  assert.equal(resumed.settings.playSurface, "mine")
  assert.equal(resumed.runState.minePausedRemainMs, 0)
  assert.equal(resumed.runState.mineSessionEndsAt, NOW + 9000 + remain)
})

test("pauseMine is a no-op without a live mine session", () => {
  const save = createInitialSave(NOW, config)
  assert.equal(pauseMine(save, NOW), save)
})

test("formatMinePauseBadge uses m:ss or seconds", () => {
  assert.equal(formatMinePauseBadge(90_000), "일시정지 1:30")
  assert.equal(formatMinePauseBadge(45_000), "일시정지 45s")
  assert.equal(formatMinePauseBadge(0), null)
})

test("isMinePaused when remain is stored off the mine surface", () => {
  const save = createInitialSave(NOW, config)
  const entered = enterClickerMine(save, NOW, config).save
  const paused = pauseMine(entered, NOW + 1000)
  assert.equal(isMinePaused(paused), true)
})
