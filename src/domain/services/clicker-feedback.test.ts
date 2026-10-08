import assert from "node:assert/strict"
import test from "node:test"
import { validateClickerFeedbackSubmission } from "./clicker-feedback.ts"

test("feedback submission trims its message and optional author", () => {
  assert.deepEqual(validateClickerFeedbackSubmission({
    category: "idea",
    message: "  더 많은 월드를 추가해 주세요.  ",
    author: "  민아  ",
  }), {
    ok: true,
    value: {
      category: "idea",
      message: "더 많은 월드를 추가해 주세요.",
      author: "민아",
    },
  })
})

test("feedback submission allows an anonymous author", () => {
  assert.deepEqual(validateClickerFeedbackSubmission({
    category: "bug",
    message: "전투 화면이 열리지 않아요.",
  }), {
    ok: true,
    value: {
      category: "bug",
      message: "전투 화면이 열리지 않아요.",
      author: "",
    },
  })
})

test("feedback submission rejects invalid categories and empty messages", () => {
  assert.equal(validateClickerFeedbackSubmission({ category: "secret", message: "오류입니다" }).ok, false)
  assert.equal(validateClickerFeedbackSubmission({ category: "bug", message: "  " }).ok, false)
  assert.equal(validateClickerFeedbackSubmission(null).ok, false)
})

test("feedback submission enforces content and author length limits", () => {
  assert.equal(validateClickerFeedbackSubmission({ category: "other", message: "아".repeat(2001) }).ok, false)
  assert.equal(validateClickerFeedbackSubmission({ category: "other", message: "좋아요", author: "가".repeat(41) }).ok, false)
})
