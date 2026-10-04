import type { SessionUser } from "@/domain/entities/user"
import type { Room, Task, Update } from "@/domain/entities/board"

export function stampRoomAuthors(
  incoming: Room,
  previous: Room,
  user: SessionUser
): Room {
  const previousUpdateIds = new Set(previous.updates.map((item) => item.id))
  const updates = incoming.updates.map((update) => {
    if (previousUpdateIds.has(update.id)) return update
    return stampUpdate(update, user)
  })

  const members = incoming.members.map((member) => {
    if (member.id !== user.id) return member
    return { ...member, name: user.name }
  })

  const tasks = incoming.tasks.map((task) => stampTaskComments(task, previous, user))

  return { ...incoming, updates, members, tasks }
}

function stampTaskComments(task: Task, previous: Room, user: SessionUser): Task {
  const prevTask = previous.tasks.find((item) => item.id === task.id)
  const prevComments = prevTask?.comments ?? []
  const comments = (task.comments ?? []).map((comment) => {
    const prev = prevComments.find((item) => item.id === comment.id)
    if (!prev) {
      return { ...comment, authorId: user.id, author: user.name }
    }
    return {
      ...comment,
      authorId: prev.authorId,
      author: prev.author || comment.author,
    }
  })
  return { ...task, comments }
}

function stampUpdate(update: Update, user: SessionUser): Update {
  return {
    ...update,
    author: user.name,
    authorId: user.id,
  }
}

export function formatAuthorAction(user: SessionUser, text: string): string {
  return `${user.name}: ${text}`
}
