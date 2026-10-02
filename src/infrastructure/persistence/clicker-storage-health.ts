import { CLICKER_ACCOUNTS_SHARED_KEY, loadClickerAccountBook } from "./clicker-account-store.ts"
import { durableStorageRequired } from "./shared-json-store.ts"
import { supabaseStorageConfigured } from "./supabase-admin.ts"
import { readSupabaseJson, writeSupabaseJson } from "./supabase-storage.ts"

export type ClickerStorageHealth = {
  supabaseConfigured: boolean
  durableRequired: boolean
  accountsKey: string
  supabaseProbe: "ok" | "miss" | "error" | "skip"
  accountCount: number | null
}

const PROBE_KEY = "clicker-storage-health-probe"

export async function checkClickerStorageHealth(): Promise<ClickerStorageHealth> {
  const supabaseConfigured = supabaseStorageConfigured()
  let supabaseProbe: ClickerStorageHealth["supabaseProbe"] = "skip"
  if (supabaseConfigured) {
    const stamp = { at: new Date().toISOString() }
    const writeStatus = await writeSupabaseJson(PROBE_KEY, stamp)
    if (writeStatus === "hit") {
      const read = await readSupabaseJson<{ at: string }>(PROBE_KEY)
      supabaseProbe = read.status === "hit" ? "ok" : read.status === "miss" ? "miss" : "error"
    } else {
      supabaseProbe = writeStatus === "miss" ? "miss" : "error"
    }
  }

  let accountCount: number | null = null
  if (supabaseConfigured && supabaseProbe === "ok") {
    try {
      const book = await loadClickerAccountBook()
      accountCount = Object.keys(book).length
    } catch {
      accountCount = null
    }
  }

  return {
    supabaseConfigured,
    durableRequired: durableStorageRequired(),
    accountsKey: CLICKER_ACCOUNTS_SHARED_KEY,
    supabaseProbe,
    accountCount,
  }
}
