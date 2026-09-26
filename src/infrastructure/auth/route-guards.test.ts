import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"
import test from "node:test"

const API_DIR = join(import.meta.dirname, "../../app/api")

/** 로그인 없이 열려 있어야 하는 API. 새로 추가할 때는 이유를 적는다. */
const PUBLIC_ROUTES: Record<string, string> = {
  "auth/login/route.ts": "로그인",
  "auth/signup/route.ts": "회원가입",
  "auth/logout/route.ts": "쿠키 삭제만 함",
  "auth/bootstrap/route.ts": "첫 회원 필요 여부만 알려 줌",
  "clicker/auth/login/route.ts": "게임 계정 로그인",
  "clicker/auth/signup/route.ts": "게임 계정 가입 (승인 없음, 사이트 권한 없음)",
  "clicker/auth/logout/route.ts": "게임 세션 쿠키 삭제만 함",
}

const HANDLER = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/g
const GUARD =
  /\b(requireApprovedUser|requireEditorUser|requireMemberManager|requireWaldoOwner|requireWaldoAdmin|getUserFromRequest|getSessionFromRequest|getClickerSession)\s*\(/

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return routeFiles(path)
    return entry.name === "route.ts" ? [path] : []
  })
}

test("every API route checks the session unless explicitly public", () => {
  const files = routeFiles(API_DIR)
  assert.ok(files.length > 0)
  const unguarded: string[] = []
  for (const file of files) {
    const route = relative(API_DIR, file).split("\\").join("/")
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
  const routes = new Set(routeFiles(API_DIR).map((f) => relative(API_DIR, f).split("\\").join("/")))
  for (const route of Object.keys(PUBLIC_ROUTES)) {
    assert.ok(routes.has(route), `${route} no longer exists`)
  }
})
