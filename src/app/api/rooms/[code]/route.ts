import { getRoomQuery, patchRoom, saveRoomContent } from "@/application/rooms"
import { toJson } from "@/application/result"
import type { Room } from "@/domain/entities/board"
import { requireApprovedUser, requireEditorUser } from "@/infrastructure/auth/guard"
import { toPublicUser } from "@/infrastructure/persistence/user-repository"
import { normalizeRoomCode } from "@/shared/ids"
import { NextResponse } from "next/server"
import { readJsonBody } from "@/infrastructure/http/read-json-body"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const auth = await requireApprovedUser(request)
  if (auth instanceof Response) return auth

  const { code } = await params
  const revisionParam = new URL(request.url).searchParams.get("revision")
  const clientRevision = revisionParam !== null ? Number(revisionParam) : null

  const result = await getRoomQuery({
    code,
    clientRevision:
      clientRevision !== null && !Number.isNaN(clientRevision) ? clientRevision : null,
  })

  return toJson(result, (value) =>
    value.kind === "unchanged"
      ? { unchanged: true, revision: value.revision, members: value.members }
      : { room: value.room }
  )
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const auth = await requireEditorUser(request)
  if (auth instanceof Response) return auth

  const { code } = await params
  try {
    const body = (await readJsonBody(request)) as { room?: unknown; revision?: number }
    const incoming = body.room as Room | null
    if (!incoming || typeof incoming !== "object" || typeof body.revision !== "number") {
      return NextResponse.json(
        { error: "잘못된 요청입니다." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      )
    }

    return toJson(
      await saveRoomContent({
        code: normalizeRoomCode(code),
        incoming,
        clientRevision: body.revision,
        actor: toPublicUser(auth.user),
      }),
      (value) => ({ room: value.room })
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "저장하지 못했습니다." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const auth = await requireApprovedUser(request)
  if (auth instanceof Response) return auth

  const code = normalizeRoomCode((await params).code)
  const body = (await readJsonBody(request)) as { type?: string; text?: string; updateId?: string }
  const actor = toPublicUser(auth.user)

  if (body.type === "post-update") {
    return toJson(
      await patchRoom({ type: "post-update", code, text: body.text ?? "", actor }),
      (v) => (v.kind === "room" ? { room: v.room } : v)
    )
  }
  if (body.type === "remove-update") {
    return toJson(
      await patchRoom({ type: "remove-update", code, updateId: body.updateId ?? "", actor }),
      (v) => (v.kind === "room" ? { room: v.room } : v)
    )
  }
  if (body.type === "heartbeat" || body.type === "join") {
    return toJson(await patchRoom({ type: body.type, code, actor }), (v) =>
      v.kind === "members"
        ? { members: v.members, revision: v.revision }
        : { room: v.room }
    )
  }

  return NextResponse.json(
    { error: "지원하지 않는 요청입니다." },
    { status: 400, headers: { "Cache-Control": "no-store" } }
  )
}
