import { loadUserDirectory, saveUserDirectory } from "@/infrastructure/persistence/user-directory"
import { mergePendingUsers } from "@/infrastructure/persistence/shared-merge"
import type { StoredUser } from "@/domain/entities/user"

export { mergePendingUsers as mergePendingSignups }

export async function loadPendingSignups(): Promise<StoredUser[]> {
  const dir = await loadUserDirectory()
  return dir.pending
}

export async function rememberPendingSignup(user: StoredUser): Promise<void> {
  if (user.status !== "pending") return
  const dir = await loadUserDirectory()
  await saveUserDirectory({
    ...dir,
    users: { ...dir.users, [user.id]: user },
    index: {
      ...dir.index,
      [user.loginId.trim().toLowerCase()]: user.id,
    },
    pending: mergePendingUsers([dir.pending, [user]]),
  })
}

export async function forgetPendingSignup(userId: string): Promise<void> {
  const dir = await loadUserDirectory()
  if (!dir.pending.some((user) => user.id === userId) && !dir.users[userId]) return
  const users = { ...dir.users }
  if (users[userId]?.status === "pending") {
    delete users[userId]
  }
  await saveUserDirectory({
    ...dir,
    users,
    pending: dir.pending.filter((user) => user.id !== userId),
  })
}

export async function findPendingSignup(userId: string): Promise<StoredUser | null> {
  const pending = await loadPendingSignups()
  return pending.find((user) => user.id === userId) ?? null
}
