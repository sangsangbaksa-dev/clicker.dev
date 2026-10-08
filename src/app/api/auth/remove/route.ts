import { removeMember } from "@/application/admin"
import { toJson } from "@/application/result"
import { requireWaldoOwner } from "@/infrastructure/auth/guard"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  const auth = await requireWaldoOwner(request)
  if (auth instanceof Response) return auth

  const body = (await request.json()) as { userId?: string }
  return toJson(await removeMember(body.userId ?? "", auth.user), (v) => ({
    removed: v.removed,
  }))
}
