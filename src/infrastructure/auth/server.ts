import "server-only"

import type { PublicUser } from "@/domain/entities/user"
import { SESSION_COOKIE, verifySessionToken } from "@/infrastructure/auth/session"
import { findUserById, toPublicUser } from "@/infrastructure/persistence/user-repository"
import { cookies } from "next/headers"
import { cache } from "react"

async function readSessionUser(): Promise<PublicUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null
  const session = await verifySessionToken(token)
  if (!session) return null
  const stored = await findUserById(session.id)
  if (!stored) return null
  return toPublicUser(stored)
}

/** Dedupes cookie auth reads within one server render (layout + page). */
export const getAuthUserFromCookies = cache(readSessionUser)

export const getApprovedUserFromCookies = cache(async (): Promise<PublicUser | null> => {
  const user = await getAuthUserFromCookies()
  if (!user || user.status === "pending") return null
  return user
})
