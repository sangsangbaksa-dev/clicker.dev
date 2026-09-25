import assert from "node:assert/strict"
import test from "node:test"
import {
  applyEdgeResponseHeaders,
  edgeCacheTtlSeconds,
  forwardHeaders,
  originUrlFor,
  rewriteLocation,
  rewriteSetCookie,
  shouldCacheAtEdge,
} from "./rewrite.ts"

test("caches hashed Next static assets", () => {
  assert.equal(shouldCacheAtEdge("GET", "/_next/static/chunks/app.js"), true)
  assert.equal(edgeCacheTtlSeconds("/_next/static/chunks/app.js"), 31_536_000)
})

test("does not cache HTML, RSC, or APIs", () => {
  assert.equal(shouldCacheAtEdge("GET", "/"), false)
  assert.equal(shouldCacheAtEdge("GET", "/login"), false)
  assert.equal(shouldCacheAtEdge("GET", "/api/auth/me"), false)
  assert.equal(shouldCacheAtEdge("POST", "/_next/static/chunks/app.js"), false)
})

test("rewrites Vercel redirects onto the edge host", () => {
  assert.equal(
    rewriteLocation("https://hsms-md.vercel.app/login", "https://hsms-md-edge.workers.dev"),
    "https://hsms-md-edge.workers.dev/login"
  )
  assert.equal(
    rewriteLocation("/ban/1", "https://hsms-md-edge.workers.dev"),
    "https://hsms-md-edge.workers.dev/ban/1"
  )
})

test("strips Domain from Set-Cookie so login works on workers.dev", () => {
  assert.equal(
    rewriteSetCookie("hsms_session=abc; Path=/; HttpOnly; Domain=hsms-md.vercel.app"),
    "hsms_session=abc; Path=/; HttpOnly"
  )
})

test("forwards the public host while fetching the Vercel origin", () => {
  const incoming = new Headers({
    cookie: "hsms_session=abc",
    "cf-connecting-ip": "203.0.113.9",
    host: "hsms-md-edge.workers.dev",
  })
  const headers = forwardHeaders(incoming, "hsms-md-edge.workers.dev")
  assert.equal(headers.get("Host"), "hsms-md.vercel.app")
  assert.equal(headers.get("X-Forwarded-Host"), "hsms-md-edge.workers.dev")
  assert.equal(headers.get("X-Forwarded-For"), "203.0.113.9")
  assert.equal(headers.get("cookie"), "hsms_session=abc")
})

test("maps origin URLs onto the incoming worker URL", () => {
  const incoming = new URL("https://edge.example/ban/1?x=1")
  const origin = originUrlFor(incoming)
  assert.equal(origin.toString(), "https://hsms-md.vercel.app/ban/1?x=1")
})

test("rewrites Location on proxied responses", () => {
  const headers = applyEdgeResponseHeaders(
    new Headers({ Location: "https://hsms-md.vercel.app/login" }),
    "https://hsms-md-edge.workers.dev"
  )
  assert.equal(headers.get("Location"), "https://hsms-md-edge.workers.dev/login")
})

test("rewrites Set-Cookie Domain on proxied responses", () => {
  const headers = applyEdgeResponseHeaders(
    new Headers({
      "Set-Cookie": "hsms_session=abc; Path=/; Domain=hsms-md.vercel.app; HttpOnly",
    }),
    "https://hsms-md-edge.workers.dev"
  )
  assert.equal(headers.get("Set-Cookie")?.includes("Domain="), false)
  assert.equal(headers.get("Set-Cookie")?.includes("hsms_session=abc"), true)
})
