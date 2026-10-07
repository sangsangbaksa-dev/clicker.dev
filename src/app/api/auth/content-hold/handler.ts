import { approveContentHold } from "@/application/admin"
import { toJson } from "@/application/result"
import { requireMemberManager } from "@/infrastructure/auth/guard"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  const auth = await requireMemberManager(request)
  if (auth instanceof Response) return auth

  const body = (await request.json()) as { userId?: string }
  return toJson(await approveContentHold({ userId: body.userId, actor: auth.user }), (value) => value)
}
