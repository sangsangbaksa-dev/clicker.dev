/**
 * Signup password-confirm checks.
 * Run: node scripts/test-signup-password-confirm.mjs
 * Requires dev server on http://127.0.0.1:8080
 */

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:8080"
const stamp = Date.now().toString(36)

function log(label, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} | ${label}${detail ? " | " + detail : ""}`)
  return ok
}

async function signup(body) {
  const res = await fetch(`${BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const payload = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, payload }
}

async function main() {
  let failed = 0
  const base = {
    loginId: `pwchk${stamp}`,
    name: "확인테스트",
    classN: 1,
    englishLevel: "a",
    mathLevel: "s",
  }

  const missing = await signup({ ...base, password: "abcdef" })
  failed += log(
    "missing confirm is rejected",
    missing.status === 400 && missing.payload.error === "비밀번호 확인을 입력해 주세요.",
    missing.payload.error
  )
    ? 0
    : 1

  const mismatch = await signup({
    ...base,
    password: "abcdef",
    passwordConfirm: "abcdeg",
  })
  failed += log(
    "mismatch is rejected",
    mismatch.status === 400 && mismatch.payload.error === "비밀번호가 일치하지 않습니다.",
    mismatch.payload.error
  )
    ? 0
    : 1

  const matched = await signup({
    ...base,
    password: "abcdef",
    passwordConfirm: "abcdef",
  })
  failed += log(
    "matching passwords create a pending account",
    matched.ok && Boolean(matched.payload.user) && matched.payload.user.status === "pending",
    JSON.stringify(matched.payload.error ?? matched.payload.user?.loginId)
  )
    ? 0
    : 1

  if (failed) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
