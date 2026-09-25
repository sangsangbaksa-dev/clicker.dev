import type { Task } from "@/domain/entities/board"

/** Local calendar day start in ms. */
export function startOfDayMs(date = new Date()): number {
  const day = new Date(date)
  day.setHours(0, 0, 0, 0)
  return day.getTime()
}

export function parseDueDateMs(dueDate: string): number | null {
  if (!dueDate) return null
  const ms = new Date(`${dueDate}T00:00:00`).getTime()
  return Number.isNaN(ms) ? null : ms
}

/** Due date is before today — shown in red. */
export function isOverdueTask(dueDate: string, now = new Date()): boolean {
  const dueMs = parseDueDateMs(dueDate)
  if (dueMs === null) return false
  return dueMs < startOfDayMs(now)
}

/** Due within the next three days (inclusive), not overdue. */
export function isDueSoonTask(dueDate: string, now = new Date()): boolean {
  const dueMs = parseDueDateMs(dueDate)
  if (dueMs === null) return false
  const today = startOfDayMs(now)
  const threeDays = 3 * 24 * 60 * 60 * 1000
  return dueMs >= today && dueMs - today <= threeDays
}

/**
 * Auto-delete one calendar day after the task turns overdue (red).
 * e.g. due Sep 7 → red on Sep 8 → removed from Sep 9.
 */
export function shouldAutoDeleteOverdueTask(dueDate: string, now = new Date()): boolean {
  const dueMs = parseDueDateMs(dueDate)
  if (dueMs === null) return false
  const deleteFromMs = dueMs + 2 * 24 * 60 * 60 * 1000
  return startOfDayMs(now) >= deleteFromMs
}

export function pruneExpiredTasks(tasks: Task[], now = new Date()): Task[] {
  return tasks.filter((task) => !shouldAutoDeleteOverdueTask(task.dueDate, now))
}

export function formatTaskDue(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date)
}
