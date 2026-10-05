import assert from "node:assert/strict"
import test from "node:test"
import {
  REBIRTH_CHOICE_IDLE,
  pickRebirthWorldline,
  rebirthConfirmDelayMs,
  releaseRebirthChoice,
} from "./clicker-rebirth-choice.ts"

const KNOWN = ["focus_line", "auto_line", "reso_line"]

test("the first pick locks, a double-click or a second row is refused as busy", () => {
  const first = pickRebirthWorldline(REBIRTH_CHOICE_IDLE, "focus_line", [], KNOWN)
  assert.deepEqual(first, { accepted: true, state: { status: "locked", id: "focus_line" } })
  for (const id of ["focus_line", "auto_line"]) {
    const again = pickRebirthWorldline(first.state, id, [], KNOWN)
    assert.equal(again.accepted, false)
    if (!again.accepted) assert.equal(again.reason, "busy")
    assert.deepEqual(again.state, first.state)
  }
})

test("walked and unknown worldlines are refused without locking", () => {
  const owned = pickRebirthWorldline(REBIRTH_CHOICE_IDLE, "auto_line", ["auto_line"], KNOWN)
  const unknown = pickRebirthWorldline(REBIRTH_CHOICE_IDLE, "nope", [], KNOWN)
  assert.deepEqual([owned.accepted, owned.state], [false, REBIRTH_CHOICE_IDLE])
  assert.deepEqual([unknown.accepted, unknown.state], [false, REBIRTH_CHOICE_IDLE])
})

test("release returns to idle; reduced motion skips the confirm flash", () => {
  assert.deepEqual(releaseRebirthChoice(), REBIRTH_CHOICE_IDLE)
  assert.equal(rebirthConfirmDelayMs(true), 0)
  assert.ok(rebirthConfirmDelayMs(false) > 0)
})
