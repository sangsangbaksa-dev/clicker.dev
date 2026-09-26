import { loginUser } from "@/application/auth"
import { toJson } from "@/application/result"
import { clientIpFromRequest } from "@/infrastructure/auth/login-throttle-store"
import { sessionCookieOptions, signSession } from "@/infrastructure/auth/session"
import { NextResponse } from "next/server"
import { readJsonBody } from "@/infrastructure/http/read-json-body"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const body = (await readJsonBody(request)) as { loginId?: string; password?: string }
    const result = await loginUser({
      loginId: body.loginId ?? "",
      password: body.password ?? "",
      clientIp: clientIpFromRequest(request),
    })
    if (!result.ok) {
      const response = toJson(result, () => ({}), false)
      const retryAfter = (result.payload as { retryAfterSeconds?: number } | undefined)
        ?.retryAfterSeconds
      if (retryAfter) response.headers.set("Retry-After", String(retryAfter))
      return response
    }

    const token = await signSession(result.value.user)
    const response = NextResponse.json({ user: result.value.user })
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
      { error: error instanceof Error ? error.message : "로그인에 실패했습니다." },
      { status: 400 }
    )
  }
}
