import {
  createGroupDocument,
  listGroupDocuments,
} from "@/application/group-docs"
import { toJson } from "@/application/result"
import { requireApprovedUser, requireEditorUser } from "@/infrastructure/auth/guard"
import { toPublicUser } from "@/infrastructure/persistence/user-repository"
import { normalizeRoomCode } from "@/shared/ids"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string; groupId: string }> }
) {
  const auth = await requireApprovedUser(request)
  if (auth instanceof Response) return auth

  const { code, groupId } = await params
  return toJson(
    await listGroupDocuments({
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
  return toJson(
    await createGroupDocument({
      code: normalizeRoomCode(code),
      groupId,
      actor: toPublicUser(auth.user),
    }),
    (value) => value
  )
}
