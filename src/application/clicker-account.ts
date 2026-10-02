import {
  normalizeLoginId,
  validateSignup,
  type ClickerAccountInput,
  type ClickerStoredAccount,
} from "../domain/services/clicker-account.ts"
import { fail, ok, type UseCaseResult } from "./use-case-result.ts"

export type ClickerAccount = ClickerStoredAccount
export type ClickerPublicAccount = { id: string; loginId: string; nickname: string }

export type ClickerAccountPorts = {
  findByLoginId(loginId: string): Promise<ClickerAccount | null>
  /** Must reject (return false) if the login id is already taken. */
  create(account: ClickerAccount): Promise<boolean>
  hash(password: string): Promise<string>
  verify(password: string, hash: string): Promise<boolean>
  newId(): string
  now(): string
}

export const toPublicAccount = (a: ClickerAccount): ClickerPublicAccount => ({
  id: a.id,
  loginId: a.loginId,
  nickname: a.nickname,
})

export async function signupClickerAccount(
  ports: ClickerAccountPorts,
  input: ClickerAccountInput,
): Promise<UseCaseResult<{ account: ClickerPublicAccount }>> {
  const problem = validateSignup(input)
  if (problem) return fail(400, problem)
  const loginId = normalizeLoginId(input.loginId)
  if (await ports.findByLoginId(loginId)) return fail(409, "이미 사용 중인 아이디예요.")
  const account: ClickerAccount = {
    id: ports.newId(),
    loginId,
    nickname: input.nickname.trim(),
    passwordHash: await ports.hash(input.password),
    createdAt: ports.now(),
  }
  if (!(await ports.create(account))) return fail(409, "이미 사용 중인 아이디예요.")
  return ok({ account: toPublicAccount(account) })
}

export async function loginClickerAccount(
  ports: ClickerAccountPorts,
  input: { loginId: string; password: string },
): Promise<UseCaseResult<{ account: ClickerPublicAccount }>> {
  const loginId = normalizeLoginId(input.loginId)
  if (!loginId || !input.password) return fail(400, "아이디와 비밀번호를 입력해 주세요.")
  const stored = await ports.findByLoginId(loginId)
  if (!stored || !(await ports.verify(input.password, stored.passwordHash))) {
    return fail(401, "아이디 또는 비밀번호가 맞지 않아요.")
  }
  return ok({ account: toPublicAccount(stored) })
}
