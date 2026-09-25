import test from "node:test"
import assert from "node:assert/strict"
import {
  challengeScore,
  DRILL_TARGET,
  ROD_EVERY_MS,
  ROD_FIRST_MS,
  settledChallengeScore,
} from "./clicker-challenge-score.ts"

const RUN_MS = 15_000

test("a live rod score only counts targets shown so far", () => {
  assert.equal(challengeScore("ROD_STRIKE", ROD_FIRST_MS + 10, 1, 0), 1)
})

test("leaving after one lucky rod does not settle as a perfect run", () => {
  const rods = Math.floor((RUN_MS - ROD_FIRST_MS) / ROD_EVERY_MS) + 1
  assert.equal(settledChallengeScore("ROD_STRIKE", RUN_MS, 1, 0), 1 / rods)
})

test("leaving after one drone does not settle as a perfect run", () => {
  assert.ok(settledChallengeScore("DRONE_RECALL", RUN_MS, 1, 0) < 0.1)
})

test("catching every target over the full run still pays 100%", () => {
  const rods = Math.floor((RUN_MS - ROD_FIRST_MS) / ROD_EVERY_MS) + 1
  assert.equal(settledChallengeScore("ROD_STRIKE", RUN_MS, rods, 0), 1)
})

test("the drill is paid by depth, so finishing it early keeps the full score", () => {
  assert.equal(settledChallengeScore("FAULT_DRILL", RUN_MS, DRILL_TARGET, 0), 1)
  assert.equal(settledChallengeScore("FAULT_DRILL", RUN_MS, DRILL_TARGET, 2), DRILL_TARGET / (DRILL_TARGET + 1))
})

test("a run with no targets scores zero instead of dividing by zero", () => {
  assert.equal(challengeScore("ROD_STRIKE", 0, 0, 0), 0)
})
