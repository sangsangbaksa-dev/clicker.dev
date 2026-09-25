import { listClassRoster } from "@/application/classes"
import { requireApprovedUser } from "@/infrastructure/auth/guard"
import { classFromCode } from "@/shared/classes"
import { normalizeRoomCode } from "@/shared/ids"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const auth = await requireApprovedUser(request)
  if (auth instanceof Response) return auth

  const code = normalizeRoomCode(new URL(request.url).searchParams.get("code") ?? "")
  if (!classFromCode(code)) {
    return NextResponse.json(
      { error: "반을 찾을 수 없습니다." },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    )
  }

  return NextResponse.json(
    { roster: await listClassRoster(code) },
    { headers: { "Cache-Control": "no-store" } }
  )
}
