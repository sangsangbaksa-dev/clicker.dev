import assert from "node:assert/strict"
import { test } from "node:test"
import { normalizeSupabaseUrl } from "./supabase-admin.ts"

test("normalizeSupabaseUrl keeps only the project origin", () => {
  const origin = "https://abcd1234.supabase.co"
  assert.equal(normalizeSupabaseUrl(origin), origin)
  assert.equal(normalizeSupabaseUrl(`${origin}/`), origin)
  assert.equal(normalizeSupabaseUrl(`${origin}/rest/v1/`), origin)
  assert.equal(normalizeSupabaseUrl("not a url/"), "not a url")
})
