import { AdminAccessDenied } from "@/components/auth/admin-access-denied"
import { AuthAccessGate } from "@/components/auth/auth-access-gate"
import { MembersPanel } from "@/components/members/members-panel"
import { listMembersWithActivity } from "@/application/admin"
import { canManageMemberLevels } from "@/domain/services/access-level"
import { getAuthUserFromCookies } from "@/infrastructure/auth/server"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function MembersPage() {
  const user = await getAuthUserFromCookies()
  if (!user) {
    redirect("/login?next=/members")
  }

  const allowed = canManageMemberLevels(user)
  const data = allowed ? await listMembersWithActivity(user) : null

  return (
    <AuthAccessGate>
      {allowed && data ? (
        <MembersPanel
          actor={user}
          initialMembers={data.members}
          initialActivity={data.activity}
          initialCanReorder={data.canReorder}
        />
      ) : (
        <AdminAccessDenied message="회원 등급은 관리자만 변경할 수 있습니다." />
      )}
    </AuthAccessGate>
  )
}
