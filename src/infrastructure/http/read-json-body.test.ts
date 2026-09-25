import assert from "node:assert/strict"
import test from "node:test"
import { readJsonBody } from "./read-json-body.ts"

function post(body: string) {
  return new Request("http://x/api", { method: "POST", body, headers: { "content-type": "application/json" } })
}

test("returns the parsed object", async () => {
  assert.deepEqual(await readJsonBody(post('{"userId":"u1"}')), { userId: "u1" })
})

test("malformed, empty, null, array and scalar bodies become {}", async () => {
  for (const body of ["{bad", "", "null", "[1,2]", "5", '"text"']) {
    assert.deepEqual(await readJsonBody(post(body)), {}, body)
  }
})
