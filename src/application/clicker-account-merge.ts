import { mergeClickerAccountBooks, type ClickerAccountBook } from "../domain/services/clicker-account-book.ts"
import { fail, ok, type UseCaseResult } from "./use-case-result.ts"

export type ClickerAccountBookPorts = {
  loadBook(): Promise<ClickerAccountBook>
  saveBook(book: ClickerAccountBook): Promise<void>
}

export async function mergeImportedClickerAccounts(
  ports: ClickerAccountBookPorts,
  incoming: ClickerAccountBook,
): Promise<UseCaseResult<{ added: number; skipped: number }>> {
  if (!incoming || typeof incoming !== "object") return fail(400, "보낸 계정 목록이 올바르지 않아요.")
  const existing = await ports.loadBook()
  const { book, added, skipped } = mergeClickerAccountBooks(existing, incoming)
  if (added > 0) await ports.saveBook(book)
  return ok({ added, skipped })
}
