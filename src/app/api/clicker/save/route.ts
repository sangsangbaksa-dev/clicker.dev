import { loadCloudSave, storeCloudSave } from "@/application/game-account"
import { clickerAccountFromCookies } from "@/infrastructure/auth/clicker-session"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const unauthorized = () => NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })
const failed = (error: unknown) =>
  NextResponse.json({ error: error instanceof Error ? error.message : "클라우드 저장소에 연결하지 못했습니다." }, { status: 503 })

/** The account's cloud save (json + when it was stored), or null. */
export async function GET() {
  const account = await clickerAccountFromCookies()
  if (!account) return unauthorized()
  try {
    return NextResponse.json({ save: await loadCloudSave(account.id) })
  } catch (error) {
    return failed(error)
  }
}

/** Body: { json } — the save as the game stores it locally. */
export async function PUT(request: Request) {
  const account = await clickerAccountFromCookies()
  if (!account) return unauthorized()
  try {
    const body = (await request.json().catch(() => ({}))) as { json?: unknown }
    const result = await storeCloudSave(account, body.json)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ meta: result.value })
  } catch (error) {
    return failed(error)
  }
}
