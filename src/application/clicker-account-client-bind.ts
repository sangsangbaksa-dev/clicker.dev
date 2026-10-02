import type { ClickerAccountClientPort } from "./ports/clicker-account-client.ts"

let client: ClickerAccountClientPort | null = null
let saveFlush: (() => void) | null = null

const noopClient: ClickerAccountClientPort = {
  initSaveSlotFromSession: () => {},
  me: async () => null,
  signup: async () => ({ ok: false, status: 503, error: "계정 기능이 준비되지 않았어요." }),
  login: async () => ({ ok: false, status: 503, error: "계정 기능이 준비되지 않았어요." }),
  logout: async () => {},
}

export function bindClickerAccountClient(port: ClickerAccountClientPort): void {
  client = port
}

export function clickerAccountClient(): ClickerAccountClientPort {
  return client ?? noopClient
}

/** Lets the game flush autosave before account handoff (registered from useClicker). */
export function bindClickerAccountSaveFlush(fn: (() => void) | null): void {
  saveFlush = fn
}

export function flushClickerSaveBeforeAccountHandoff(): void {
  saveFlush?.()
}

export function resetClickerAccountClientBindings(): void {
  client = null
  saveFlush = null
}
