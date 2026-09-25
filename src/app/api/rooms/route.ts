import { createRoom } from "@/infrastructure/persistence/room-repository"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      title?: string
      subject?: string
      description?: string
      deadline?: string
      creatorName?: string
      creatorId?: string
    }

    const room = await createRoom({
      title: body.title ?? "",
      subject: body.subject ?? "",
      description: body.description ?? "",
      deadline: body.deadline ?? "",
      creatorName: body.creatorName ?? "",
      creatorId: body.creatorId,
    })

    return NextResponse.json({ room }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    const message = error instanceof Error ? error.message : "방을 만들지 못했습니다."
    const status = message.includes("입력") ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
