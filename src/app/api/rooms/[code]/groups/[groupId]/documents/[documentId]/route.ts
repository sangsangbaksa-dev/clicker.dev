import { deleteGroupDocument, saveGroupDocument } from "@/application/group-docs"
import { toJson } from "@/application/result"
import { requireEditorUser } from "@/infrastructure/auth/guard"
import { toPublicUser } from "@/infrastructure/persistence/user-repository"
import { normalizeRoomCode } from "@/shared/ids"
import { NextResponse } from "next/server"
import { readJsonBody } from "@/infrastructure/http/read-json-body"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ code: string; groupId: string; documentId: string }> }
) {
  const auth = await requireEditorUser(request)
  if (auth instanceof Response) return auth

  const { code, groupId, documentId } = await params
  try {
    const body = (await readJsonBody(request)) as {
      title?: string
      body?: string
      revision?: number
    }
    if (typeof body.revision !== "number") {
      return NextResponse.json(
        { error: "잘못된 요청입니다." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      )
    }

    return toJson(
      await saveGroupDocument({
        code: normalizeRoomCode(code),
        groupId,
        documentId,
        title: String(body.title ?? ""),
        body: String(body.body ?? ""),
        clientRevision: body.revision,
        actor: toPublicUser(auth.user),
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ code: string; groupId: string; documentId: string }> }
) {
  const auth = await requireEditorUser(request)
  if (auth instanceof Response) return auth

  const { code, groupId, documentId } = await params
  return toJson(
    await deleteGroupDocument({
      code: normalizeRoomCode(code),
      groupId,
      documentId,
      actor: toPublicUser(auth.user),
    }),
    (value) => value
  )
}
