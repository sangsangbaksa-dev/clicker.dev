import { recoverLostMembers } from "@/application/admin"
import { toJson } from "@/application/result"
import { requireMemberManager } from "@/infrastructure/auth/guard"
import { toPublicUser } from "@/infrastructure/persistence/user-repository"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  const auth = await requireMemberManager(request)
  if (auth instanceof Response) return auth

  return toJson(await recoverLostMembers(toPublicUser(auth.user)), (value) => ({
    beforeCount: value.beforeCount,
    afterCount: value.afterCount,
    restored: value.restored,
    blobCount: value.blobCount,
    blobPaths: value.blobPaths,
    roomsRestored: value.roomsRestored,
    notesRestored: value.notesRestored,
  }))
}
