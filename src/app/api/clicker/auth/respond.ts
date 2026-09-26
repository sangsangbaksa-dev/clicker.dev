import type { UseCaseResult } from "@/application/result"
import { clickerSessionCookie, signClickerSession, type ClickerSession } from "@/infrastructure/auth/clicker-session"
import { NextResponse } from "next/server"

/** Credentials body for signup / login; anything malformed becomes empty strings. */
export async function readCredentials(request: Request): Promise<{ nickname: string; password: string }> {
  const body = (await request.json().catch(() => ({}))) as { nickname?: unknown; password?: unknown }
  return {
    nickname: typeof body.nickname === "string" ? body.nickname : "",
    password: typeof body.password === "string" ? body.password : "",
  }
}

/** Success sets the game session cookie; failure passes the use-case error through. */
export async function sessionResponse(result: UseCaseResult<ClickerSession>): Promise<NextResponse> {
  const headers = { "Cache-Control": "no-store" }
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status, headers })
  const response = NextResponse.json({ account: result.value }, { headers })
  response.cookies.set(clickerSessionCookie(await signClickerSession(result.value)))
  return response
}
