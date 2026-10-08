import { clearClickerSessionCookie } from "@/infrastructure/auth/clicker-session"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST() {
  const response = NextResponse.json({ ok: true })
  clearClickerSessionCookie(response)
  return response
}
