import { boardTabHref, type BoardTab } from "@/domain/services/board-tabs"
import { SCHOOL_LEVEL_LABELS } from "@/domain/services/school-note-kinds"
import {
  ENGLISH_CLASSES,
  HOMEROOM_CLASSES,
  MATH_CLASSES,
  classFromCode,
  type ClassInfo,
} from "@/shared/classes"
import { cn } from "@/shared/utils"
import Link from "next/link"

const ROWS: { title: string; items: readonly ClassInfo[] }[] = [
  { title: "일반", items: HOMEROOM_CLASSES },
  { title: "영어", items: ENGLISH_CLASSES },
  { title: "수학", items: MATH_CLASSES },
]

function pillLabel(item: ClassInfo): string {
  if (item.kind === "homeroom" || !item.level) return item.label
  return SCHOOL_LEVEL_LABELS[item.level]
}

export function ClassSwitcher({
  activeCode,
  activeTab = "tasks",
}: {
  activeCode?: string
  activeTab?: BoardTab
}) {
  const active = activeCode ? classFromCode(activeCode) : null

  return (
    <nav aria-label="반 선택" className="flex min-w-0 flex-col gap-1.5">
      {ROWS.map((row) => (
        <div key={row.title} className="flex flex-wrap items-center gap-1">
          <span className="w-9 shrink-0 text-xs text-muted-foreground">{row.title}</span>
          {row.items.map((item) => {
            const selected = active?.n === item.n
            return (
              <Link
                key={item.n}
                href={boardTabHref(item.slug, activeTab)}
                className={cn(
                  "inline-flex h-8 items-center justify-center whitespace-nowrap rounded-md border px-3 text-sm",
                  selected
                    ? "border-primary bg-muted font-medium text-primary"
                    : "border-border bg-card text-foreground hover:bg-muted"
                )}
              >
                {pillLabel(item)}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
