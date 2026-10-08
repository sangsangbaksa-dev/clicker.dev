import {
  canDirectProfileChange,
  isWaldoAccount,
} from "@/domain/services/access-level"
import type { ProfileChanges } from "@/domain/entities/user"
import { requireApprovedUser } from "@/infrastructure/auth/guard"
import {
  createProfileChangeRequest,
  getProfileChangeRequestForUser,
} from "@/infrastructure/persistence/profile-requests"
import { sessionCookieOptions, signSession } from "@/infrastructure/auth/session"
import { applyProfileChanges, toPublicUser } from "@/infrastructure/persistence/user-repository"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const auth = await requireApprovedUser(request)
  if (auth instanceof Response) return auth

  const pendingRequest = await getProfileChangeRequestForUser(auth.user.id)
  return NextResponse.json(
    { pendingRequest },
    { headers: { "Cache-Control": "no-store" } }
  )
}

export async function PATCH(request: Request) {
  const auth = await requireApprovedUser(request)
  if (auth instanceof Response) return auth

  try {
    const body = (await request.json()) as ProfileChanges
    const changes: ProfileChanges = {}
    if (body.loginId !== undefined) changes.loginId = body.loginId
    if (body.classN !== undefined) changes.classN = body.classN
    if (body.englishLevel !== undefined) changes.englishLevel = body.englishLevel
    if (body.mathLevel !== undefined) changes.mathLevel = body.mathLevel

    const actor = toPublicUser(auth.user)
    const direct = canDirectProfileChange(actor)

    if (direct) {
      const user = await applyProfileChanges(auth.user.id, changes)
      const response = NextResponse.json({ user, direct: true })
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

    if (isWaldoAccount(auth.user.loginId) && changes.loginId !== undefined) {
      return NextResponse.json(
        { error: "Waldo 소유자 계정의 아이디는 바꿀 수 없습니다." },
        { status: 400 }
      )
    }

    const pendingRequest = await createProfileChangeRequest(auth.user.id, changes)
    return NextResponse.json({ pendingRequest, direct: false })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "프로필 변경에 실패했습니다."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
