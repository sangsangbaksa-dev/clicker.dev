import { getBootstrapInfo } from "@/infrastructure/persistence/user-repository"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const { needsFirstMember, approvedCount } = await getBootstrapInfo()
  return NextResponse.json(
    {
      needsFirstMember,
      approvedCount,
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}
