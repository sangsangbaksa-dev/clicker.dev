import { loginClickerAccount } from "@/application/clicker-account"
import { clickerSessionCookie, signClickerSession } from "@/infrastructure/auth/clicker-session"
import { clickerAccountPorts } from "@/infrastructure/persistence/clicker-account-store"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const b = (await request.json()) as Record<string, unknown>
    const result = await loginClickerAccount(clickerAccountPorts, { loginId: String(b.loginId ?? ""), password: String(b.password ?? "") })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    const res = NextResponse.json({ account: result.value.account }, { headers: { "Cache-Control": "no-store" } })
    const c = clickerSessionCookie(await signClickerSession(result.value.account))
    res.cookies.set(c.name, c.value, c)
    return res
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "요청을 처리하지 못했어요." }, { status: 500 })
  }
}
