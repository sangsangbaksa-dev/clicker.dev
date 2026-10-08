import { clearMemberRecords } from "@/application/admin"
import { toJson } from "@/application/result"
import { requireMemberManager } from "@/infrastructure/auth/guard"
import { toPublicUser } from "@/infrastructure/persistence/user-repository"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  const auth = await requireMemberManager(request)
  if (auth instanceof Response) return auth

  try {
    const body = (await request.json()) as { userId?: string }
    return toJson(
      await clearMemberRecords({
        actor: toPublicUser(auth.user),
        userId: body.userId,
      }),
      (value) => ({ cleared: value.cleared })
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "기록을 삭제하지 못했습니다." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    )
  }
}
