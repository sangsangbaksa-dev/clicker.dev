import { classFromNumber } from "@/shared/classes"
import type { AuthUser } from "@/domain/entities/board"

/** Where to send a newly approved member after signup approval. */
export function defaultBoardHref(user: Pick<AuthUser, "classN">): string {
  const cls = user.classN ? classFromNumber(user.classN) : null
  return cls ? `/ban/${cls.slug}` : "/"
}
