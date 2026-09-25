import { removeMember } from "@/application/admin"
import { toJson } from "@/application/result"
import { requireWaldoOwner } from "@/infrastructure/auth/guard"
import { readJsonBody } from "@/infrastructure/http/read-json-body"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  const auth = await requireWaldoOwner(request)
  if (auth instanceof Response) return auth

  const body = (await readJsonBody(request)) as { userId?: string }
  return toJson(await removeMember(body.userId ?? "", auth.user), (v) => ({
    removed: v.removed,
  }))
}
