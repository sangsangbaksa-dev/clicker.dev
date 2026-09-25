import {
  canApproveMembers,
  canAssignAdmin,
  canEditBoard,
} from "@/domain/services/access-level"
import type { StoredUser } from "@/domain/entities/user"
import { getSessionFromRequest } from "@/infrastructure/auth/session"
import { findUserById, toPublicUser, userIsApproved } from "@/infrastructure/persistence/user-repository"
import { NextResponse } from "next/server"

export function isApproved(user: StoredUser): boolean {
  return userIsApproved(user)
}

export async function getUserFromRequest(
  request: Request
): Promise<StoredUser | null> {
  const session = await getSessionFromRequest(request)
  if (!session) return null
  return findUserById(session.id)
}

export async function requireApprovedUser(request: Request): Promise<
  | { user: StoredUser }
  | NextResponse
> {
  const user = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    )
  }
  if (!isApproved(user)) {
    return NextResponse.json(
      { error: "승인된 회원만 볼 수 있습니다.", status: "pending" },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    )
  }
  return { user }
}

export async function requireEditorUser(request: Request): Promise<
  | { user: StoredUser }
  | NextResponse
> {
  const auth = await requireApprovedUser(request)
  if (auth instanceof NextResponse) return auth
  if (!canEditBoard(toPublicUser(auth.user))) {
    return NextResponse.json(
      { error: "뷰어는 보드 내용을 수정할 수 없습니다." },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    )
  }
  return auth
}

/** Waldo 소유자 + 관리자 (승인·등급 변경) */
export async function requireMemberManager(request: Request): Promise<
  | { user: StoredUser }
  | NextResponse
> {
  const auth = await requireApprovedUser(request)
  if (auth instanceof NextResponse) return auth
  if (!canApproveMembers(toPublicUser(auth.user))) {
    return NextResponse.json(
      { error: "관리자만 이용할 수 있습니다." },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    )
  }
  return auth
}

/** Waldo 소유자 전용 (관리자 지정·퇴원) */
export async function requireWaldoOwner(request: Request): Promise<
  | { user: StoredUser }
  | NextResponse
> {
  const auth = await requireApprovedUser(request)
  if (auth instanceof NextResponse) return auth
  if (!canAssignAdmin(toPublicUser(auth.user))) {
    return NextResponse.json(
      { error: "Waldo 소유자만 이용할 수 있습니다." },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    )
  }
  return auth
}

/** @deprecated use requireMemberManager or requireWaldoOwner */
export async function requireWaldoAdmin(request: Request): Promise<
  | { user: StoredUser }
  | NextResponse
> {
  return requireMemberManager(request)
}
