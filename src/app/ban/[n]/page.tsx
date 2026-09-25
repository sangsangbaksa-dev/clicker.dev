import { AuthAccessGate } from "@/components/auth/auth-access-gate"
import { RoomBoard } from "@/components/room/room-board"
import { listClassRoster } from "@/application/classes"
import { classFromParam } from "@/shared/classes"
import { normalizeBoardTab } from "@/domain/services/board-tabs"
import { getApprovedUserFromCookies } from "@/infrastructure/auth/server"
import { getRoomFresh } from "@/infrastructure/persistence/room-repository"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function BanPage({
  params,
  searchParams,
}: {
  params: Promise<{ n: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { n } = await params
  const { tab } = await searchParams
  const cls = classFromParam(n)
  if (!cls) redirect("/")
  const approved = await getApprovedUserFromCookies()
  let initialRoom = null
  let initialRoster: Awaited<ReturnType<typeof listClassRoster>> = []
  if (approved) {
    try {
      ;[initialRoom, initialRoster] = await Promise.all([
        getRoomFresh(cls.code),
        listClassRoster(cls.code),
      ])
    } catch {
      initialRoom = null
      initialRoster = []
    }
  }
  const activeTab = normalizeBoardTab(tab)
  return (
    <AuthAccessGate>
      <RoomBoard
        classN={cls.n}
        code={cls.code}
        initialRoom={initialRoom}
        initialRoster={initialRoster}
        activeTab={activeTab}
      />
    </AuthAccessGate>
  )
}
