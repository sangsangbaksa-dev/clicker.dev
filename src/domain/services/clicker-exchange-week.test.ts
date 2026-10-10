import assert from "node:assert/strict"
import test from "node:test"
import type { MetaState } from "../entities/clicker.ts"
import { EXCHANGE_WEEK_MS, exchangeWeek, exchangeWeekStart, sanitizeExchange } from "./clicker-exchange-week.ts"

// Monday 2026-10-05 00:00 KST = Sunday 2026-10-04 15:00 UTC
const MON_KST = Date.UTC(2026, 9, 4, 15)

test("week starts Monday 00:00 KST", () => {
  assert.equal(exchangeWeekStart(MON_KST), MON_KST)
  assert.equal(exchangeWeekStart(MON_KST + EXCHANGE_WEEK_MS - 1), MON_KST)
  assert.equal(exchangeWeekStart(MON_KST + EXCHANGE_WEEK_MS), MON_KST + EXCHANGE_WEEK_MS)
  assert.equal(exchangeWeekStart(MON_KST - 1), MON_KST - EXCHANGE_WEEK_MS)
})

test("exchangeWeek reads an older week as empty", () => {
  const meta = { exchange: { weekStart: MON_KST - EXCHANGE_WEEK_MS, bought: { a: 2 } } } as unknown as MetaState
  assert.deepEqual(exchangeWeek(meta, MON_KST + 1000), { weekStart: MON_KST, bought: {} })
  const cur = { exchange: { weekStart: MON_KST, bought: { a: 2 } } } as unknown as MetaState
  assert.deepEqual(exchangeWeek(cur, MON_KST + 1000).bought, { a: 2 })
})

test("sanitizeExchange keeps only well-formed counters", () => {
  assert.equal(sanitizeExchange(null), undefined)
  assert.equal(sanitizeExchange({ weekStart: "x" }), undefined)
  assert.equal(sanitizeExchange({ weekStart: Infinity }), undefined)
  assert.deepEqual(sanitizeExchange({ weekStart: 5, bought: { a: 2.9, b: -1, c: "3", d: NaN } }), {
    weekStart: 5,
    bought: { a: 2 },
  })
  assert.deepEqual(sanitizeExchange({ weekStart: 5 }), { weekStart: 5, bought: {} })
})
