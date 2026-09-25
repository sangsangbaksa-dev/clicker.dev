/**
 * After signup, pending-signups.json should include the new account.
 * Run: node scripts/test-pending-signup-list.mjs
 */

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:8080"
const stamp = Date.now().toString(36)
const loginId = `pend${stamp}`

function log(label, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} | ${label}${detail ? " | " + detail : ""}`)
  return ok
}

async function main() {
  const res = await fetch(`${BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      loginId,
      name: "대기목록테스트",
      password: "abcdef",
      passwordConfirm: "abcdef",
      classN: 1,
      englishLevel: "a",
      mathLevel: "s",
    }),
  })
  const payload = await res.json().catch(() => ({}))
  let failed = 0
  failed += log("signup accepted", res.ok && payload.user?.status === "pending", payload.error ?? payload.user?.loginId)
    ? 0
    : 1

  const { readFile } = await import("node:fs/promises")
  const raw = await readFile(new URL("../data/users/pending-signups.json", import.meta.url), "utf8")
  const pending = JSON.parse(raw)
  failed += log(
    "pending registry contains the new signup",
    Array.isArray(pending) && pending.some((user) => user.loginId === loginId),
    Array.isArray(pending) ? `count=${pending.length}` : "missing file"
  )
    ? 0
    : 1

  if (failed) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
