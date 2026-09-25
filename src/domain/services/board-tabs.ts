export type BoardTab = "tasks" | "notes" | "feed" | "groups"

export const BOARD_TABS: { id: BoardTab; label: string }[] = [
  { id: "tasks", label: "할 일" },
  { id: "groups", label: "조" },
  { id: "notes", label: "노트" },
  { id: "feed", label: "소식" },
]

export function normalizeBoardTab(value: string | null | undefined): BoardTab {
  if (value === "notes" || value === "feed" || value === "groups") {
    return value
  }
  return "tasks"
}

export function boardTabHref(classRef: number | string, tab: BoardTab): string {
  const key = String(classRef)
  if (tab === "tasks") return `/ban/${key}`
  return `/ban/${key}?tab=${tab}`
}
