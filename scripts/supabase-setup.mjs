#!/usr/bin/env node
/**
 * Verify Supabase Storage bucket access for HSMS.
 * Run after creating a Supabase project and applying migrations:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/supabase-setup.mjs
 */

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY

if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
  process.exit(1)
}

const { createClient } = await import("@supabase/supabase-js")
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const probe = "hsms-md/_probe.json"
const payload = JSON.stringify({ ok: true, at: new Date().toISOString() })

const upload = await supabase.storage.from("hsms-md").upload(probe, payload, {
  upsert: true,
  contentType: "application/json",
})

if (upload.error) {
  console.error("Upload failed:", upload.error.message)
  console.error("Create bucket `hsms-md` in Supabase Dashboard → Storage, or run:")
  console.error("  npx supabase db push")
  process.exit(1)
}

const download = await supabase.storage.from("hsms-md").download(probe)
if (download.error) {
  console.error("Download failed:", download.error.message)
  process.exit(1)
}

await supabase.storage.from("hsms-md").remove([probe])
console.log("Supabase Storage bucket hsms-md is ready.")
