import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let admin: SupabaseClient | null = null

export const HSMS_STORAGE_BUCKET = "hsms-md"

export function supabaseProjectUrl(): string | null {
  return (
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    null
  )
}

export function supabaseServiceRoleKey(): string | null {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    null
  )
}

export function supabaseStorageConfigured(): boolean {
  return Boolean(supabaseProjectUrl() && supabaseServiceRoleKey())
}

export function getSupabaseAdmin(): SupabaseClient {
  const url = supabaseProjectUrl()
  const key = supabaseServiceRoleKey()
  if (!url || !key) {
    throw new Error("Supabase URL and service role key are required.")
  }
  if (!admin) {
    admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return admin
}
