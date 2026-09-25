import { purgeNonWaldoSchool } from "@/application/admin"
import { toJson } from "@/application/result"
import { requireWaldoOwner } from "@/infrastructure/auth/guard"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  const auth = await requireWaldoOwner(request)
  if (auth instanceof Response) return auth

  return toJson(await purgeNonWaldoSchool(auth.user), (value) => ({
    removed: value.removed,
    tasksCleared: value.tasksCleared,
  }))
}
