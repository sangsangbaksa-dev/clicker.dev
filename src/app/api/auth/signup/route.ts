import { signupUser } from "@/application/auth"
import { toJson } from "@/application/result"
import type { SchoolLevel } from "@/domain/entities/user"
import { sessionCookieOptions, signSession } from "@/infrastructure/auth/session"
import { NextResponse } from "next/server"
import { readJsonBody } from "@/infrastructure/http/read-json-body"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const body = (await readJsonBody(request)) as {
      loginId?: string
      name?: string
      password?: string
      passwordConfirm?: string
      classN?: number
      englishLevel?: SchoolLevel
      mathLevel?: SchoolLevel
    }

    const result = await signupUser(body)
    if (!result.ok) return toJson(result, () => ({}), false)

    const token = await signSession(result.value.user)
    const response = NextResponse.json(result.value)
    const cookie = sessionCookieOptions(token)
    response.cookies.set(cookie.name, cookie.value, {
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite,
      secure: cookie.secure,
      path: cookie.path,
      maxAge: cookie.maxAge,
    })
    return response
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "회원가입에 실패했습니다." },
      { status: 400 }
    )
  }
}
