import type { UserActivityItem } from "@/domain/entities/user"
import { ScrollArea } from "@/components/ui/scroll-area"

function formatWhen(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function kindLabel(item: UserActivityItem) {
  if (item.kind === "update") return "소식"
  if (item.kind === "comment") return "댓글"
  if (item.kind === "task") return "할 일"
  return "노트"
}

function ActivityItem({ item }: { item: UserActivityItem }) {
  return (
    <li className="rounded-lg bg-muted/50 px-2.5 py-2 text-xs leading-5">
      <p className="font-medium text-foreground/90">
        {kindLabel(item)}
        <span className="mx-1 text-muted-foreground">·</span>
        {item.roomLabel}
        {item.noteKind ? (
          <span className="text-muted-foreground"> · {item.noteKind}</span>
        ) : null}
        {item.taskTitle ? (
          <span className="text-muted-foreground"> · {item.taskTitle}</span>
        ) : null}
      </p>

      {item.kind === "note" || item.kind === "task" ? (
        <div className="mt-1 space-y-1.5">
          {item.removed?.trim() ? (
            <div className="rounded-md border border-destructive/20 bg-destructive/5 px-2 py-1.5">
              <p className="text-[11px] font-medium text-destructive">삭제</p>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-foreground/80">
                {item.removed}
              </p>
            </div>
          ) : null}
          {item.added?.trim() ? (
            <div className="rounded-md border border-success/25 bg-success/10 px-2 py-1.5">
              <p className="text-[11px] font-medium text-success">
                추가
              </p>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-foreground/80">
                {item.added}
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-0.5 whitespace-pre-wrap break-words text-foreground/80">
          {item.text}
        </p>
      )}

      <p className="mt-1 text-[11px] text-muted-foreground">
        {formatWhen(item.createdAt)}
      </p>
    </li>
  )
}

export function UserActivityList({
  items,
  emptyLabel = "활동 기록 없음",
}: {
  items: UserActivityItem[]
  emptyLabel?: string
}) {
  if (items.length === 0) {
    return (
      <p className="text-xs leading-5 text-muted-foreground">{emptyLabel}</p>
    )
  }

  const list = (
    <ul className="space-y-2 pr-2">
      {items.map((item, index) => (
        <ActivityItem key={`${item.kind}-${item.createdAt}-${index}`} item={item} />
      ))}
    </ul>
  )

  if (items.length <= 8) {
    return list
  }

  return (
    <ScrollArea className="max-h-72">
      {list}
    </ScrollArea>
  )
}
