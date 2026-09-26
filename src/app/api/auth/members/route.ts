import { listMembersWithActivity, reorderMember } from "@/application/admin"
import { toJson } from "@/application/result"
import { requireMemberManager } from "@/infrastructure/auth/guard"
import { toPublicUser } from "@/infrastructure/persistence/user-repository"
import { NextResponse } from "next/server"
import { readJsonBody } from "@/infrastructure/http/read-json-body"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const auth = await requireMemberManager(request)
  if (auth instanceof Response) return auth

  const data = await listMembersWithActivity(toPublicUser(auth.user))
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } })
}

export async function PATCH(request: Request) {
  const auth = await requireMemberManager(request)
  if (auth instanceof Response) return auth

  const body = (await readJsonBody(request)) as {
    userId?: string
    direction?: "up" | "down"
  }

  return toJson(
    await reorderMember({
      actor: toPublicUser(auth.user),
      userId: body.userId,
      direction: body.direction,
    }),
    (v) => v,
    false
  )
}
