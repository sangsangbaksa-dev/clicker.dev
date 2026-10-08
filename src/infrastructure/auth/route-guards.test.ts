import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"
import test from "node:test"

const HANDLER_ROOT = join(import.meta.dirname, "../http/routes")

/** 로그인 없이 열려 있어야 하는 API handler. 새로 추가할 때는 이유를 적는다. */
const PUBLIC_ROUTES: Record<string, string> = {
  "auth/login.ts": "로그인",
  "auth/signup.ts": "회원가입",
  "auth/logout.ts": "쿠키 삭제만 함",
  "auth/bootstrap.ts": "첫 회원 필요 여부만 알려 줌",
  "clicker/auth/login.ts": "게임 계정 로그인",
  "clicker/auth/signup.ts": "게임 계정 회원가입",
  "clicker/auth/logout.ts": "게임 세션 쿠키 삭제만 함",
  "clicker/auth/me.ts": "게임 세션이 없으면 null만 돌려줌",
  "clicker/feedback.ts": "익명 피드백 제출과 지정 아이디를 통한 조회",
}

const HANDLER = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/g
const GUARD =
  /\b(requireApprovedUser|requireEditorUser|requireMemberManager|requireWaldoOwner|requireWaldoAdmin|getUserFromRequest|getSessionFromRequest|clickerAccountFromCookies)\s*\(/

function handlerFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return handlerFiles(path)
    return entry.name.endsWith(".ts") ? [path] : []
  })
}

test("every API route checks the session unless explicitly public", () => {
  const files = handlerFiles(HANDLER_ROOT)
  assert.ok(files.length > 0)
  const unguarded: string[] = []
  for (const file of files) {
    const route = relative(HANDLER_ROOT, file).split("\\").join("/")
    if (route in PUBLIC_ROUTES) continue
    const source = readFileSync(file, "utf8")
    const methods = [...source.matchAll(HANDLER)].map((m) => m[1])
    if (methods.length > 0 && !GUARD.test(source)) {
      unguarded.push(`${route} (${methods.join(", ")})`)
    }
  }
  assert.deepEqual(unguarded, [], "로그인 확인 없는 API가 있습니다. guard를 붙이거나 PUBLIC_ROUTES에 이유와 함께 추가하세요.")
})

test("public route allowlist has no stale entries", () => {
  const routes = new Set(handlerFiles(HANDLER_ROOT).map((f) => relative(HANDLER_ROOT, f).split("\\").join("/")))
  for (const route of Object.keys(PUBLIC_ROUTES)) {
    assert.ok(routes.has(route), `${route} no longer exists`)
  }
})
