import { getClickerCloudSave, putClickerCloudSave } from "@/application/clicker-account"
import { toJson } from "@/application/result"
import { getClickerSession } from "@/infrastructure/auth/clicker-session"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const signedOut = () => NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })
const unavailable = (error: unknown) =>
  NextResponse.json({ error: error instanceof Error ? error.message : "저장소 오류" }, { status: 503 })

export async function GET(request: Request) {
  const session = await getClickerSession(request)
  if (!session) return signedOut()
  try {
    return toJson(await getClickerCloudSave(session), (save) => ({ save }))
  } catch (error) {
    return unavailable(error)
  }
}

export async function PUT(request: Request) {
  const session = await getClickerSession(request)
  if (!session) return signedOut()
  try {
    const body = (await request.json().catch(() => ({}))) as { raw?: unknown; force?: unknown; baseSavedAt?: unknown }
    return toJson(await putClickerCloudSave(session, body), (value) => value)
  } catch (error) {
    return unavailable(error)
  }
}
