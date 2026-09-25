import type { Task } from "@/domain/entities/board"

export function taskWriteText(task: Pick<Task, "title" | "notes" | "dueDate">): string {
  const title = task.title.trim()
  const due = task.dueDate.trim()
  const notes = task.notes.trim()
  const lines: string[] = []
  if (title) lines.push(title)
  if (due) lines.push(`마감 ${due}`)
  if (notes) lines.push(notes)
  return lines.join("\n")
}

export type TaskWriteChange = {
  taskTitle: string
  previousText: string
  nextText: string
}

/** Compare 할 일 title/notes/due only. Comments are recorded separately. */
export function listTaskWriteChanges(previous: Task[], incoming: Task[]): TaskWriteChange[] {
  const prevById = new Map(previous.map((task) => [task.id, task]))
  const nextIds = new Set(incoming.map((task) => task.id))
  const changes: TaskWriteChange[] = []

  for (const task of incoming) {
    const before = prevById.get(task.id)
    const nextText = taskWriteText(task)
    const previousText = before ? taskWriteText(before) : ""
    if (previousText === nextText) continue
    changes.push({
      taskTitle: task.title.trim() || before?.title.trim() || "할 일",
      previousText,
      nextText,
    })
  }

  for (const task of previous) {
    if (nextIds.has(task.id)) continue
    const previousText = taskWriteText(task)
    if (!previousText) continue
    changes.push({
      taskTitle: task.title.trim() || "할 일",
      previousText,
      nextText: "",
    })
  }

  return changes
}

/** Keep the other computer's rows, and local-only drafts that are not on the server yet. */
export function mergeItemsOnConflict<T extends { id: string }>(
  local: T[],
  remote: T[]
): T[] {
  const remoteIds = new Set(remote.map((item) => item.id))
  return [...remote, ...local.filter((item) => !remoteIds.has(item.id))]
}
