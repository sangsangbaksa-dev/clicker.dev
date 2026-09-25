import type { ClassSummary } from "@/shared/classes"
import { classFromCode, userBelongsToClass } from "@/shared/classes"
import { listClassSummaries } from "@/infrastructure/persistence/room-repository"
import { listApprovedMembers } from "@/infrastructure/persistence/user-repository"
import { cache } from "react"

export async function listClasses(): Promise<ClassSummary[]> {
  return listClassSummaries()
}

export type ClassRosterPerson = {
  id: string
  name: string
}

async function listClassRosterUncached(code: string): Promise<ClassRosterPerson[]> {
  const info = classFromCode(code)
  if (!info) return []
  const members = await listApprovedMembers()
  return members
    .filter((user) => userBelongsToClass(user, info))
    .map((user) => ({ id: user.id, name: user.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"))
}

export const listClassRoster = cache(listClassRosterUncached)
