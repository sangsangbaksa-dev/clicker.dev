import { readClickerSession } from "@/infrastructure/auth/clicker-session"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const account = await readClickerSession(request)
  return NextResponse.json({ account }, { headers: { "Cache-Control": "no-store" } })
}
