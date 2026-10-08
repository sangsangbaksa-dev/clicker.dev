import { loginClicker } from "@/application/game-account"
import { setClickerSessionCookie, signClickerSession } from "@/infrastructure/auth/clicker-session"
import { NextResponse } from "next/server"


export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { loginId?: string; password?: string }
    const result = await loginClicker(body.loginId, body.password)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    const response = NextResponse.json({ account: result.value })
    setClickerSessionCookie(response, await signClickerSession(result.value))
    return response
  } catch {
    return NextResponse.json({ error: "로그인에 실패했습니다." }, { status: 503 })
  }
}
