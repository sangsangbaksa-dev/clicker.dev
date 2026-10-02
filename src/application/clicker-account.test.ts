import assert from "node:assert/strict"
import test from "node:test"
import { loginClickerAccount, signupClickerAccount, type ClickerAccount, type ClickerAccountPorts } from "./clicker-account.ts"

function memoryPorts(): ClickerAccountPorts {
  const db = new Map<string, ClickerAccount>()
  let n = 0
  return {
    findByLoginId: async (id) => db.get(id) ?? null,
    create: async (a) => (db.has(a.loginId) ? false : (db.set(a.loginId, a), true)),
    hash: async (p) => `h:${p}`,
    verify: async (p, h) => h === `h:${p}`,
    newId: () => `u${++n}`,
    now: () => "2026-10-01T00:00:00.000Z",
  }
}
const input = { loginId: "Miner01", nickname: "광부", password: "secret1", passwordConfirm: "secret1" }

test("signup then login works, password never leaks", async () => {
  const ports = memoryPorts()
  const s = await signupClickerAccount(ports, input)
  assert.ok(s.ok)
  assert.deepEqual(s.ok && s.value.account, { id: "u1", loginId: "miner01", nickname: "광부" })
  const l = await loginClickerAccount(ports, { loginId: "MINER01", password: "secret1" })
  assert.ok(l.ok)
})

test("duplicate id and wrong password are refused", async () => {
  const ports = memoryPorts()
  await signupClickerAccount(ports, input)
  const dup = await signupClickerAccount(ports, input)
  assert.ok(!dup.ok && dup.status === 409)
  const bad = await loginClickerAccount(ports, { loginId: "miner01", password: "nope" })
  assert.ok(!bad.ok && bad.status === 401)
  const none = await loginClickerAccount(ports, { loginId: "ghost", password: "secret1" })
  assert.ok(!none.ok && none.status === 401)
})

test("invalid signup input is rejected before touching storage", async () => {
  const r = await signupClickerAccount(memoryPorts(), { ...input, password: "1", passwordConfirm: "1" })
  assert.ok(!r.ok && r.status === 400)
})
