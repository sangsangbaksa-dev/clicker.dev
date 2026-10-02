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

const KEY = "clicker-accounts"
type Book = Record<string, ClickerAccount>
const FILE = () => dataPath("clicker", "accounts.json")

async function load(): Promise<Book> {
  const layers = await readSharedLayers<Book>(KEY, () => readJsonFile<Book>(FILE()))
  return layers.blob ?? layers.cache ?? layers.file ?? layers.snapshot ?? {}
}

export const clickerAccountPorts: ClickerAccountPorts = {
  findByLoginId: async (loginId) => (await load())[loginId] ?? null,
  async create(account) {
    const book = await load()
    if (book[account.loginId]) return false
    const next = { ...book, [account.loginId]: account }
    await writeSharedJson(KEY, next, () => writeJsonFile(FILE(), next).catch(() => {}))
    return true
  },
  hash: hashPassword,
  verify: verifyPassword,
  newId: () => randomUUID(),
  now: () => new Date().toISOString(),
}
