"use client"

import { GroupChatPanel } from "@/components/room/group-chat-panel"
import { GroupDocsPanel } from "@/components/room/group-docs-panel"
import type { GroupPerson } from "@/domain/services/class-groups"
import { useGroupLive } from "@/hooks/use-group-live"

export function GroupCollabPanel({
  roomCode,
  groupId,
  people,
  currentUserId,
}: {
  roomCode: string
  groupId: string
  people: GroupPerson[]
  currentUserId?: string
}) {
  const live = useGroupLive(roomCode, groupId)
  return (
    <div className="grid h-full min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(16rem,18rem)] gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] lg:grid-rows-none lg:items-stretch">
      <GroupDocsPanel live={live} people={people} />
      <GroupChatPanel live={live} currentUserId={currentUserId} />
    </div>
  )
}
