import assert from "node:assert/strict"
import test from "node:test"
import {
  boxCenter,
  decideSpaceKeydown,
  isTypingTarget,
  resolveKeyboardStrikePoint,
  resolveSpacePoint,
  SPACE_HOLD_CPS,
  SPACE_HOLD_INTERVAL_MS,
  type SpaceKeyInput,
} from "./clicker-space-input.ts"

const base: SpaceKeyInput = {
  code: "Space",
  repeat: false,
  ctrl: false,
  meta: false,
  alt: false,
  typing: false,
  modalOpen: false,
  holding: false,
}

test("hold rate is 5 cps", () => {
  assert.equal(SPACE_HOLD_CPS, 5)
  assert.equal(SPACE_HOLD_INTERVAL_MS, 200)
})

test("a plain Space press starts a click", () => {
  assert.equal(decideSpaceKeydown(base), "start")
})

test("key-repeat and an already-running hold never click again", () => {
  assert.equal(decideSpaceKeydown({ ...base, repeat: true }), "swallow")
  assert.equal(decideSpaceKeydown({ ...base, holding: true }), "swallow")
})

test("typing, modals, modifiers and other keys are ignored", () => {
  assert.equal(decideSpaceKeydown({ ...base, typing: true }), "ignore")
  assert.equal(decideSpaceKeydown({ ...base, modalOpen: true }), "ignore")
  assert.equal(decideSpaceKeydown({ ...base, ctrl: true }), "ignore")
  assert.equal(decideSpaceKeydown({ ...base, code: "Enter" }), "ignore")
})

test("typing targets", () => {
  assert.equal(isTypingTarget("INPUT", false), true)
  assert.equal(isTypingTarget("textarea", false), true)
  assert.equal(isTypingTarget("DIV", true), true)
  assert.equal(isTypingTarget("BUTTON", false), false)
  assert.equal(isTypingTarget(null, false), false)
})

test("space point: last pointer, else ore centre", () => {
  assert.deepEqual(resolveSpacePoint({ x: 3, y: 4 }, { x: 50, y: 60 }), { x: 3, y: 4 })
  assert.deepEqual(resolveSpacePoint(null, { x: 50, y: 60 }), { x: 50, y: 60 })
})

test("box center is the middle of the ore box", () => {
  assert.deepEqual(boxCenter({ left: 100, top: 40, width: 200, height: 120 }), { x: 200, y: 100 })
})

test("keyboard strikes follow the cursor when it is on the ore", () => {
  const cursor = { x: 5, y: 6 }
  assert.deepEqual(resolveKeyboardStrikePoint(cursor, false, { x: 1, y: 1 }), cursor)
  assert.deepEqual(resolveKeyboardStrikePoint(cursor, true, { x: 1, y: 1 }), cursor)
})

test("a focused ore takes keyboard strikes at its center without a cursor", () => {
  assert.deepEqual(resolveKeyboardStrikePoint(null, true, { x: 1, y: 2 }), { x: 1, y: 2 })
})

test("keyboard strikes are void with no cursor on the ore and no ore focus", () => {
  assert.equal(resolveKeyboardStrikePoint(null, false, { x: 1, y: 2 }), null)
  assert.equal(resolveKeyboardStrikePoint(null, true, null), null)
})
