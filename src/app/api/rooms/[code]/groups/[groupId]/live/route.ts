import { getGroupLive, touchGroupTyping } from "@/application/group-collab"
import { toJson } from "@/application/result"
import { requireApprovedUser, requireEditorUser } from "@/infrastructure/auth/guard"
import { toPublicUser } from "@/infrastructure/persistence/user-repository"
import { normalizeRoomCode } from "@/shared/ids"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string; groupId: string }> }
) {
  const auth = await requireApprovedUser(request)
  if (auth instanceof Response) return auth

  const { code, groupId } = await params
  const url = new URL(request.url)
  return toJson(
    await getGroupLive({
      code: normalizeRoomCode(code),
      groupId,
      actor: toPublicUser(auth.user),
      docsStamp: url.searchParams.get("docs") ?? undefined,
      chatStamp: url.searchParams.get("chat") ?? undefined,
    }),
    (value) => value
  )
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string; groupId: string }> }
) {
  const auth = await requireEditorUser(request)
  if (auth instanceof Response) return auth

  const { code, groupId } = await params
  try {
    const body = (await request.json()) as { surface?: "docs" | "chat" }
    return toJson(
      await touchGroupTyping({
        code: normalizeRoomCode(code),
        groupId,
        actor: toPublicUser(auth.user),
        surface: body.surface === "docs" ? "docs" : "chat",
      }),
      (value) => value
    )
  } catch {
    return NextResponse.json(
      { error: "잘못된 요청입니다." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    )
  }
}
