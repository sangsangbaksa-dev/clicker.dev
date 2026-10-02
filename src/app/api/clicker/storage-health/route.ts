import { checkClickerStorageHealth } from "@/infrastructure/persistence/clicker-storage-health"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** Public probe: Supabase Storage wiring for clicker accounts (`clicker-accounts` JSON). */
export async function GET() {
  try {
    const health = await checkClickerStorageHealth()
    const ok =
      !health.durableRequired ||
      (health.supabaseConfigured && health.supabaseProbe === "ok")
    return NextResponse.json(
      { ok, ...health },
      { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "storage health check failed",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    )
  }
}
