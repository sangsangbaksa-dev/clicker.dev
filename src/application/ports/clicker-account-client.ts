import type { ClickerPublicAccount } from "@/application/clicker-account"

export type ClickerAccountAuthInput = {
  loginId: string
  nickname: string
  password: string
  passwordConfirm: string
}

export type ClickerAccountClientResult =
  | { ok: true; account: ClickerPublicAccount }
  | { ok: false; status: number; error: string }

export type ClickerAccountClientPort = {
  /** Align the save slot with the stored session before the game loads. */
  initSaveSlotFromSession(): void
  me(): Promise<ClickerPublicAccount | null>
  signup(input: ClickerAccountAuthInput): Promise<ClickerAccountClientResult>
  login(input: Pick<ClickerAccountAuthInput, "loginId" | "password">): Promise<ClickerAccountClientResult>
  logout(): Promise<void>
}

export const CLICKER_ACCOUNT_CHANGED_EVENT = "clicker-account-changed"
