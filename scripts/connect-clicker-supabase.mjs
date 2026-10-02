#!/usr/bin/env node
/**
 * Wire Supabase Storage for clicker.dev (and HSMS JSON stores).
 *
 * 1. Apply bucket migration in Supabase SQL editor:
 *    supabase/migrations/20260920110000_hsms_storage.sql
 * 2. Export keys, then:
 *    SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/connect-clicker-supabase.mjs
 *
 * Optional Vercel (clicker-dev): set VERCEL_TOKEN and run with --vercel
 */

import { spawnSync } from "node:child_process"

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY

if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (service role, not anon).")
  process.exit(1)
}

const setup = spawnSync("node", ["scripts/supabase-setup.mjs"], {
  stdio: "inherit",
  env: process.env,
})
if (setup.status !== 0) process.exit(setup.status ?? 1)

const { createClient } = await import("@supabase/supabase-js")
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const probe = "hsms-md/clicker-accounts-probe.json"
const body = JSON.stringify({ ok: true, at: new Date().toISOString() })
const upload = await supabase.storage.from("hsms-md").upload(probe, body, {
  upsert: true,
  contentType: "application/json",
})
if (upload.error) {
  console.error("clicker-accounts path probe failed:", upload.error.message)
  process.exit(1)
}
await supabase.storage.from("hsms-md").remove([probe])
console.log("clicker-accounts Storage path is writable (hsms-md/clicker-accounts.json).")

if (process.argv.includes("--vercel")) {
  const token = process.env.VERCEL_TOKEN
  if (!token) {
    console.error("Set VERCEL_TOKEN to push env to Vercel, or add vars in the dashboard.")
    process.exit(1)
  }
  const project = process.env.VERCEL_PROJECT ?? "clicker-dev"
  for (const [name, value] of [
    ["SUPABASE_URL", url],
    ["SUPABASE_SERVICE_ROLE_KEY", key],
  ]) {
    const r = spawnSync(
      "npx",
      ["vercel", "env", "add", name, "production", "preview", "development", "--force", "--token", token, project],
      { input: value, encoding: "utf8", stdio: ["pipe", "inherit", "inherit"] },
    )
    if (r.status !== 0) {
      console.error(`vercel env add ${name} failed`)
      process.exit(r.status ?? 1)
    }
  }
  console.log(`Vercel project "${project}" updated. Redeploy for clicker auth to use Supabase.`)
}

console.log("Done. Hit GET /api/clicker/storage-health on the deployment to confirm.")
