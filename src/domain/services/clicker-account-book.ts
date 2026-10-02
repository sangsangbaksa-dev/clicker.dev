import type { ClickerStoredAccount } from "./clicker-account.ts"

export const CLICKER_ACCOUNT_BOOK_MAX = 50_000
const BCRYPT_PREFIX = "$2"

export type ClickerAccountBook = Record<string, ClickerStoredAccount>

export function isStoredPasswordHash(value: unknown): boolean {
  return typeof value === "string" && value.startsWith(BCRYPT_PREFIX) && value.length >= 20
}

/** Merge imported rows into the durable book without overwriting existing login ids. */
export function mergeClickerAccountBooks(
  existing: ClickerAccountBook,
  incoming: ClickerAccountBook,
): { book: ClickerAccountBook; added: number; skipped: number } {
  const next: ClickerAccountBook = { ...existing }
  let added = 0
  let skipped = 0
  for (const [loginId, row] of Object.entries(incoming)) {
    if (next[loginId]) {
      skipped++
      continue
    }
    if (!row || row.loginId !== loginId || !isStoredPasswordHash(row.passwordHash)) {
      skipped++
      continue
    }
    if (Object.keys(next).length >= CLICKER_ACCOUNT_BOOK_MAX) {
      skipped++
      continue
    }
    next[loginId] = row
    added++
  }
  return { book: next, added, skipped }
}
