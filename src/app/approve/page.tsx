import { AdminAccessDenied } from "@/components/auth/admin-access-denied"
import { ApprovePanel } from "@/components/members/approve-panel"
import { AuthAccessGate } from "@/components/auth/auth-access-gate"
import { listPendingWithActivity } from "@/application/admin"
import { canApproveMembers } from "@/domain/services/access-level"
import { getAuthUserFromCookies } from "@/infrastructure/auth/server"
import { listPendingProfileChangeRequests } from "@/infrastructure/persistence/profile-requests"
import { collectUserActivityMap } from "@/application/activity"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function ApprovePage() {
  const user = await getAuthUserFromCookies()
  if (!user) {
    redirect("/login?next=/approve")
  }

  const allowed = canApproveMembers(user)
  const [pendingData, requests] = allowed
    ? await Promise.all([
        listPendingWithActivity(),
        listPendingProfileChangeRequests(),
      ])
    : [
        { pending: [], activity: {} as Record<string, never> },
        [],
      ]
  const requestActivity =
    requests.length > 0
      ? await collectUserActivityMap(
          requests.map((item) => item.userId),
          12
        )
      : {}

  return (
    <AuthAccessGate>
      {allowed ? (
        <ApprovePanel
          actor={user}
          initialPending={pendingData.pending}
          initialActivity={pendingData.activity}
          initialRequests={requests}
          initialRequestActivity={requestActivity}
        />
      ) : (
        <AdminAccessDenied message="관리자만 접근할 수 있습니다." />
      )}
    </AuthAccessGate>
  )
}
