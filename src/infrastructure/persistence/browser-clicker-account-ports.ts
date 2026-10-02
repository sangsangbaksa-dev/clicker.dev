import type { ClickerAccount, ClickerAccountPorts } from "@/application/clicker-account"
import { hashPassword, verifyPassword } from "@/infrastructure/auth/password"

const BOOK_KEY = "aurelia-clicker-accounts-v1"
type Book = Record<string, ClickerAccount>

function storage(): Storage | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function readBrowserClickerAccountBook(): Book {
  try {
    const parsed: unknown = JSON.parse(storage()?.getItem(BOOK_KEY) ?? "{}")
    if (!parsed || typeof parsed !== "object") return {}
    return parsed as Book
  } catch {
    return {}
  }
}

function readBook(): Book {
  return readBrowserClickerAccountBook()
}

function writeBook(book: Book): boolean {
  try {
    storage()?.setItem(BOOK_KEY, JSON.stringify(book))
    return true
  } catch {
    return false
  }
}

function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  return c?.randomUUID?.() ?? `local-${Date.now().toString(36)}`
}

export const browserClickerAccountPorts: ClickerAccountPorts = {
  findByLoginId: async (loginId) => readBook()[loginId] ?? null,
  async create(account) {
    const book = readBook()
    if (book[account.loginId]) return false
    const next = { ...book, [account.loginId]: account }
    return writeBook(next)
  },
  hash: hashPassword,
  verify: verifyPassword,
  newId,
  now: () => new Date().toISOString(),
}
