import { requireMemberManager } from "@/infrastructure/auth/guard"
import {
  approveProfileChangeRequest,
  listPendingProfileChangeRequests,
  rejectProfileChangeRequest,
} from "@/infrastructure/persistence/profile-requests"
import { collectUserActivityMap } from "@/application/activity"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const auth = await requireMemberManager(request)
  if (auth instanceof Response) return auth

  const requests = await listPendingProfileChangeRequests()
  const activity = await collectUserActivityMap(
    requests.map((item) => item.userId),
    12
  )
  return NextResponse.json(
    { requests, activity },
    { headers: { "Cache-Control": "no-store" } }
  )
}

export async function POST(request: Request) {
  const auth = await requireMemberManager(request)
  if (auth instanceof Response) return auth

  try {
    const body = (await request.json()) as {
      requestId?: string
      action?: "approve" | "reject"
    }
    const requestId = body.requestId?.trim()
    if (!requestId || (body.action !== "approve" && body.action !== "reject")) {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
    }

    if (body.action === "approve") {
      const user = await approveProfileChangeRequest(requestId, auth.user)
      return NextResponse.json({ user })
    }

    await rejectProfileChangeRequest(requestId, auth.user)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "처리에 실패했습니다."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
