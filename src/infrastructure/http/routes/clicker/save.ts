import { loadCloudSave, storeCloudSave } from "@/application/game-account"
import { clickerAccountFromCookies } from "@/infrastructure/auth/clicker-session"
import { NextResponse } from "next/server"


const unauthorized = () => NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })
const failed = () =>
  NextResponse.json({ error: "클라우드 저장소에 연결하지 못했습니다." }, { status: 503 })

/** The account's cloud save (json + when it was stored), or null. */
export async function GET() {
  const account = await clickerAccountFromCookies()
  if (!account) return unauthorized()
  try {
    return NextResponse.json({ save: await loadCloudSave(account.id) })
  } catch {
    return failed()
  }
}

/** Body: { json } — the save as the game stores it locally. */
export async function PUT(request: Request) {
  const account = await clickerAccountFromCookies()
  if (!account) return unauthorized()
  try {
    const body = (await request.json().catch(() => ({}))) as { json?: unknown }
    const result = await storeCloudSave(account.id, body.json)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ meta: result.value })
  } catch {
    return failed()
  }
}
