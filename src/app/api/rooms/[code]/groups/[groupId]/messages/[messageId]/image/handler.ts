import { getGroupChatImage } from "@/application/group-chat"
import { requireApprovedUser } from "@/infrastructure/auth/guard"
import { toPublicUser } from "@/infrastructure/persistence/user-repository"
import { normalizeRoomCode } from "@/shared/ids"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string; groupId: string; messageId: string }> }
) {
  const auth = await requireApprovedUser(request)
  if (auth instanceof Response) return auth

  const { code, groupId, messageId } = await params
  const result = await getGroupChatImage({
    code: normalizeRoomCode(code),
    groupId,
    messageId,
    actor: toPublicUser(auth.user),
  })
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status, headers: { "Cache-Control": "no-store" } }
    )
  }
  return new NextResponse(Buffer.from(result.value.bytes), {
    status: 200,
    headers: {
      "Content-Type": result.value.mime,
      "Cache-Control": "private, no-store",
    },
  })
}
