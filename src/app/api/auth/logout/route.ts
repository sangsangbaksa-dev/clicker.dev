import { clearSessionCookieOptions } from "@/infrastructure/auth/session"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST() {
  const response = NextResponse.json({ ok: true })
  const cookie = clearSessionCookieOptions()
  response.cookies.set(cookie.name, cookie.value, {
    httpOnly: cookie.httpOnly,
    sameSite: cookie.sameSite,
    secure: cookie.secure,
    path: cookie.path,
    maxAge: cookie.maxAge,
  })
  return response
}
