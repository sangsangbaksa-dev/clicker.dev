import { clearClickerSessionCookie } from "@/infrastructure/auth/clicker-session"
import { NextResponse } from "next/server"


export async function POST() {
  const response = NextResponse.json({ ok: true })
  clearClickerSessionCookie(response)
  return response
}
