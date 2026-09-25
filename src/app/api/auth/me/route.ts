import {
  clearSessionCookieOptions,
  getSessionFromRequest,
  sessionCookieOptions,
  signSession,
} from "@/infrastructure/auth/session"
import { findUserById, toPublicUser } from "@/infrastructure/persistence/user-repository"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const noStore = { "Cache-Control": "no-store" } as const

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401, headers: noStore })
  }

  const stored = await findUserById(session.id)
  if (!stored) {
    const response = NextResponse.json(
      { user: null, removed: true },
      { status: 403, headers: noStore }
    )
    const cleared = clearSessionCookieOptions()
    response.cookies.set(cleared.name, cleared.value, {
      httpOnly: cleared.httpOnly,
      sameSite: cleared.sameSite,
      secure: cleared.secure,
      path: cleared.path,
      maxAge: cleared.maxAge,
    })
    return response
  }

  const user = toPublicUser(stored)
  const response = NextResponse.json({ user }, { headers: noStore })
  const token = await signSession(user)
  const cookie = sessionCookieOptions(token)
  response.cookies.set(cookie.name, cookie.value, {
    httpOnly: cookie.httpOnly,
    sameSite: cookie.sameSite,
    secure: cookie.secure,
    path: cookie.path,
    maxAge: cookie.maxAge,
  })
  return response
}
