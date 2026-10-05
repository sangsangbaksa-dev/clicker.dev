import { signupClicker } from "@/application/game-account"
import { setClickerSessionCookie, signClickerSession } from "@/infrastructure/auth/clicker-session"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, string | undefined>
    const result = await signupClicker(body)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    const response = NextResponse.json({ account: result.value })
    setClickerSessionCookie(response, await signClickerSession(result.value))
    return response
  } catch {
    return NextResponse.json({ error: "회원가입에 실패했습니다." }, { status: 503 })
  }
}
