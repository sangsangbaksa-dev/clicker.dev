import { clickerSessionCookie } from "@/infrastructure/auth/clicker-session"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST() {
  const res = NextResponse.json({ ok: true })
  const c = clickerSessionCookie("", true)
  res.cookies.set(c.name, c.value, c)
  return res
}
