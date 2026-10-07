import { requireEditorUser } from "@/infrastructure/auth/guard"
import { createRoom } from "@/infrastructure/persistence/room-repository"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  const auth = await requireEditorUser(request)
  if (auth instanceof Response) return auth

  try {
    const body = (await request.json()) as {
      title?: string
      subject?: string
      description?: string
      deadline?: string
    }

    const room = await createRoom({
      title: body.title ?? "",
      subject: body.subject ?? "",
      description: body.description ?? "",
      deadline: body.deadline ?? "",
      creatorName: auth.user.name,
      creatorId: auth.user.id,
    })

    return NextResponse.json({ room }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    const message = error instanceof Error ? error.message : "방을 만들지 못했습니다."
    const status = message.includes("입력") ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
