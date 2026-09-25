import { listGroupChat, postGroupChat } from "@/application/group-chat"
import { toJson } from "@/application/result"
import { requireApprovedUser, requireEditorUser } from "@/infrastructure/auth/guard"
import { toPublicUser } from "@/infrastructure/persistence/user-repository"
import { normalizeRoomCode } from "@/shared/ids"
import { NextResponse } from "next/server"
import { readJsonBody } from "@/infrastructure/http/read-json-body"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

async function readPostBody(request: Request): Promise<{
  body: string
  imageBytes: Uint8Array | null
}> {
  const contentType = request.headers.get("content-type") ?? ""
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData()
    const file = form.get("image")
    let imageBytes: Uint8Array | null = null
    if (file instanceof File && file.size > 0) {
      imageBytes = new Uint8Array(await file.arrayBuffer())
    }
    return { body: String(form.get("body") ?? ""), imageBytes }
  }
  const payload = (await readJsonBody(request)) as { body?: string }
  return { body: String(payload.body ?? ""), imageBytes: null }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string; groupId: string }> }
) {
  const auth = await requireApprovedUser(request)
  if (auth instanceof Response) return auth

  const { code, groupId } = await params
  return toJson(
    await listGroupChat({
      code: normalizeRoomCode(code),
      groupId,
      actor: toPublicUser(auth.user),
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
    const payload = await readPostBody(request)
    return toJson(
      await postGroupChat({
        code: normalizeRoomCode(code),
        groupId,
        actor: toPublicUser(auth.user),
        body: payload.body,
        imageBytes: payload.imageBytes,
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
