import assert from "node:assert/strict"
import test from "node:test"
import { isClickerStaticHost } from "./clicker-static-host.ts"

test("isClickerStaticHost reflects NEXT_PUBLIC_CLICKER_STATIC_HOST", () => {
  const prev = process.env.NEXT_PUBLIC_CLICKER_STATIC_HOST
  try {
    delete process.env.NEXT_PUBLIC_CLICKER_STATIC_HOST
    assert.equal(isClickerStaticHost(), false)
    process.env.NEXT_PUBLIC_CLICKER_STATIC_HOST = "1"
    assert.equal(isClickerStaticHost(), true)
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_CLICKER_STATIC_HOST
    else process.env.NEXT_PUBLIC_CLICKER_STATIC_HOST = prev
  }
})
