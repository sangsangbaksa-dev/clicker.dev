import { mergeImportedClickerAccounts } from "@/application/clicker-account-merge"
import { clickerAccountBookPorts } from "@/infrastructure/persistence/clicker-account-store"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** Import browser-local account hashes into Supabase-backed storage (no overwrite). */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { accounts?: Record<string, unknown> }
    const incoming = body.accounts ?? {}
    const result = await mergeImportedClickerAccounts(clickerAccountBookPorts, incoming as never)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json(result.value, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    const message = error instanceof Error ? error.message : "요청을 처리하지 못했어요."
    const status = /Supabase|Storage|공유 저장소/i.test(message) ? 503 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
