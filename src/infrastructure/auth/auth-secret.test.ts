import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import {
  DEV_AUTH_SECRET,
  authSecretDeployProblem,
  resolveAuthSecret,
} from "./auth-secret.ts"

const STRONG = "x".repeat(32)

test("production never falls back to a built-in secret", () => {
  assert.throws(() => resolveAuthSecret({ NODE_ENV: "production" }))
  assert.throws(() => resolveAuthSecret({ NODE_ENV: "production", AUTH_SECRET: "  " }))
  assert.throws(() =>
    resolveAuthSecret({ NODE_ENV: "production", NETLIFY_SITE_ID: "site-id" })
  )
  assert.equal(resolveAuthSecret({ NODE_ENV: "production", AUTH_SECRET: STRONG }), STRONG)
})

test("development uses the local dev secret", () => {
  assert.equal(resolveAuthSecret({ NODE_ENV: "development" }), DEV_AUTH_SECRET)
})

test("production deploy builds reject missing or weak AUTH_SECRET", () => {
  assert.ok(authSecretDeployProblem({ VERCEL_ENV: "production" }))
  assert.ok(authSecretDeployProblem({ VERCEL_ENV: "production", AUTH_SECRET: "short" }))
  assert.ok(authSecretDeployProblem({ VERCEL_ENV: "production", AUTH_SECRET: DEV_AUTH_SECRET }))
  assert.ok(authSecretDeployProblem({ NETLIFY: "true", CONTEXT: "production" }))
  assert.equal(authSecretDeployProblem({ VERCEL_ENV: "production", AUTH_SECRET: STRONG }), null)
})

test("preview, CI and local builds are not blocked", () => {
  assert.equal(authSecretDeployProblem({ VERCEL_ENV: "preview" }), null)
  assert.equal(authSecretDeployProblem({ NETLIFY: "true", CONTEXT: "deploy-preview" }), null)
  assert.equal(authSecretDeployProblem({ CI: "true", NODE_ENV: "production" }), null)
})

test("session signing reads the secret only through resolveAuthSecret", () => {
  const source = readFileSync(join(import.meta.dirname, "session.ts"), "utf8")
  assert.match(source, /resolveAuthSecret\(process\.env\)/)
  assert.doesNotMatch(source, /NETLIFY_SITE_ID|default-secret/)
})
