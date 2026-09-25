import { fail, type UseCaseResult } from "@/application/result"
import { isWaldoAccount } from "@/domain/services/access-level"
import {
  CONTENT_HOLD_USER_MESSAGE,
  CONTENT_REJECT_MESSAGE,
  findDisallowedSnippet,
} from "@/domain/services/content-moderation"
import type { PublicUser } from "@/domain/entities/user"
import { applyContentHold } from "@/infrastructure/persistence/user-repository"

export async function rejectDisallowedContent(
  actor: Pick<PublicUser, "id" | "loginId">,
  texts: readonly string[]
): Promise<UseCaseResult<never> | null> {
  const snippet = findDisallowedSnippet(texts)
  if (!snippet) return null
  if (isWaldoAccount(actor.loginId)) {
    return fail(422, CONTENT_REJECT_MESSAGE)
  }
  await applyContentHold(actor.id, snippet)
  return fail(422, CONTENT_HOLD_USER_MESSAGE, { payload: { contentHold: true } })
}
