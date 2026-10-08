import { changeAccessLevel } from "@/application/admin"
import { toJson } from "@/application/result"
import type { AccessLevel } from "@/domain/entities/user"
import { requireMemberManager } from "@/infrastructure/auth/guard"
import { sessionCookieOptions, signSession } from "@/infrastructure/auth/session"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function PATCH(request: Request) {
  const auth = await requireMemberManager(request)
  if (auth instanceof Response) return auth

  const body = (await request.json()) as {
    userId?: string
    accessLevel?: AccessLevel
  }

  const result = await changeAccessLevel({
    userId: body.userId,
    accessLevel: body.accessLevel,
    actor: auth.user,
  })

  if (!result.ok) {
    return toJson(result, () => ({}), false)
  }

  const response = NextResponse.json({ user: result.value.user })
  if (result.value.refreshSession) {
    const token = await signSession(result.value.user)
    const cookie = sessionCookieOptions(token)
    response.cookies.set(cookie.name, cookie.value, {
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite,
      secure: cookie.secure,
      path: cookie.path,
      maxAge: cookie.maxAge,
    })
  }
  return response
}
