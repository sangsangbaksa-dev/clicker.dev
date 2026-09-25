import { listPendingWithActivity } from "@/application/admin"
import { requireMemberManager } from "@/infrastructure/auth/guard"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const auth = await requireMemberManager(request)
  if (auth instanceof Response) return auth

  const data = await listPendingWithActivity()
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } })
}
