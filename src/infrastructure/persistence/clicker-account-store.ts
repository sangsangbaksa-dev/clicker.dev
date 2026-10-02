import { randomUUID } from "node:crypto"
import type { ClickerAccount, ClickerAccountPorts } from "@/application/clicker-account"
import { hashPassword, verifyPassword } from "@/infrastructure/auth/password"
import { dataPath } from "@/infrastructure/persistence/data-dir"
import {
  readJsonFile,
  readSharedLayers,
  writeJsonFile,
  writeSharedJson,
} from "@/infrastructure/persistence/shared-json-store"

export const CLICKER_ACCOUNTS_SHARED_KEY = "clicker-accounts"

const KEY = CLICKER_ACCOUNTS_SHARED_KEY
type Book = Record<string, ClickerAccount>
const FILE = () => dataPath("clicker", "accounts.json")

export async function loadClickerAccountBook(): Promise<Book> {
  const layers = await readSharedLayers<Book>(KEY, () => readJsonFile<Book>(FILE()))
  return layers.blob ?? layers.cache ?? layers.file ?? layers.snapshot ?? {}
}

export async function saveClickerAccountBook(book: Book): Promise<void> {
  await writeSharedJson(KEY, book, () => writeJsonFile(FILE(), book).catch(() => {}))
}

async function load(): Promise<Book> {
  return loadClickerAccountBook()
}

export const clickerAccountBookPorts = {
  loadBook: loadClickerAccountBook,
  saveBook: saveClickerAccountBook,
}

export const clickerAccountPorts: ClickerAccountPorts = {
  findByLoginId: async (loginId) => (await load())[loginId] ?? null,
  async create(account) {
    const book = await load()
    if (book[account.loginId]) return false
    const next = { ...book, [account.loginId]: account }
    try {
      await saveClickerAccountBook(next)
    } catch {
      return false
    }
    return true
  },
  hash: hashPassword,
  verify: verifyPassword,
  newId: () => randomUUID(),
  now: () => new Date().toISOString(),
}
