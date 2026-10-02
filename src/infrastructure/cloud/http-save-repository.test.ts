import assert from "node:assert/strict"
import test from "node:test"
import { createHttpSaveRepository } from "./http-save-repository.ts"

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
}
function html(status = 404) {
  return new Response("<html>404</html>", { status, headers: { "content-type": "text/html" } })
}

test("static host (HTML 404 / network error) → unavailable everywhere", async () => {
  const stat = createHttpSaveRepository({ fetch: async () => html() })
  assert.deepEqual(await stat.availability(), { state: "unavailable" })
  assert.deepEqual(await stat.load(), { status: "unavailable" })
  assert.deepEqual(await stat.save({ code: "c", savedAt: 1 }), { status: "unavailable" })
  const down = createHttpSaveRepository({ fetch: async () => { throw new Error("offline") } })
  assert.deepEqual(await down.availability(), { state: "unavailable" })
})

test("availability: signed in / signed out with a safe link / unsafe link", async () => {
  const urls: string[] = []
  const f = (body: unknown) => async (u: string) => (urls.push(u), json(body))
  assert.deepEqual(await createHttpSaveRepository({ fetch: f({ signedIn: true, email: "me@gmail.com" }) }).availability(), { state: "signed-in", email: "me@gmail.com" })
  assert.deepEqual(await createHttpSaveRepository({ fetch: f({ signedIn: false, signInUrl: "/api/auth/google/start" }) }).availability(), { state: "signed-out", signInUrl: "/api/auth/google/start" })
  assert.deepEqual(await createHttpSaveRepository({ fetch: f({ signedIn: false, signInUrl: "https://evil.example" }) }).availability(), { state: "unavailable" })
  assert.equal(urls[0], "/api/clicker/cloud-save/status")
})

test("basePath prefixes the route; requests are same-origin with no stored credentials", async () => {
  let seen: { url: string; init?: RequestInit } | null = null
  const repo = createHttpSaveRepository({ basePath: "/clicker.dev", fetch: async (url, init) => ((seen = { url, init }), json({ empty: true }, 404)) })
  assert.deepEqual(await repo.load(), { status: "empty" })
  assert.equal(seen!.url, "/clicker.dev/api/clicker/cloud-save")
  assert.equal(seen!.init?.credentials, "same-origin")
  assert.equal((seen!.init?.headers as Record<string, string> | undefined)?.Authorization, undefined)
})

test("load: found, 401, malformed", async () => {
  assert.deepEqual(await createHttpSaveRepository({ fetch: async () => json({ code: "AURELIA1.x", savedAt: 5, updatedAt: 6 }) }).load(), {
    status: "found",
    record: { code: "AURELIA1.x", savedAt: 5, updatedAt: 6 },
  })
  assert.deepEqual(await createHttpSaveRepository({ fetch: async () => json({ error: "x" }, 401) }).load(), { status: "signed-out" })
  assert.equal((await createHttpSaveRepository({ fetch: async () => json({ code: 1 }) }).load()).status, "error")
})

test("save: PUT body has only code + savedAt; maps 401 / server errors", async () => {
  let init: RequestInit | undefined
  const ok = createHttpSaveRepository({ fetch: async (_u, i) => ((init = i), json({ updatedAt: 42 })) })
  assert.deepEqual(await ok.save({ code: "AURELIA1.x", savedAt: 7 }), { status: "saved", updatedAt: 42 })
  assert.equal(init?.method, "PUT")
  assert.deepEqual(JSON.parse(String(init?.body)), { code: "AURELIA1.x", savedAt: 7 })
  assert.deepEqual(await createHttpSaveRepository({ fetch: async () => json({}, 401) }).save({ code: "c", savedAt: 1 }), { status: "signed-out" })
  assert.deepEqual(await createHttpSaveRepository({ fetch: async () => json({ error: "용량 초과" }, 413) }).save({ code: "c", savedAt: 1 }), { status: "error", message: "용량 초과" })
})
