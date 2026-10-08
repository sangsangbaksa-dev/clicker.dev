import { listClasses } from "@/application/classes"
import { requireApprovedUser } from "@/infrastructure/auth/guard"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const auth = await requireApprovedUser(request)
  if (auth instanceof Response) return auth

  return NextResponse.json(
    { classes: await listClasses() },
    { headers: { "Cache-Control": "no-store" } }
  )
}
