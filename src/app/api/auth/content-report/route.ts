import { rejectDisallowedContent } from "@/application/moderation"
import { toJson } from "@/application/result"
import { requireApprovedUser } from "@/infrastructure/auth/guard"
import { toPublicUser } from "@/infrastructure/persistence/user-repository"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  const auth = await requireApprovedUser(request)
  if (auth instanceof Response) return auth

  const body = (await request.json()) as { texts?: unknown }
  const texts = Array.isArray(body.texts)
    ? body.texts.map((item) => String(item ?? ""))
    : []

  const blocked = await rejectDisallowedContent(toPublicUser(auth.user), texts)
  if (blocked) return toJson(blocked, () => ({}), false)
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } })
}
