import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"

const ROOT = join(import.meta.dirname, "../..")

function importsIn(file: string): string[] {
  const text = readFileSync(file, "utf8")
  const hits: string[] = []
  for (const m of text.matchAll(/from\s+["'](@\/[^"']+)["']/g)) hits.push(m[1])
  return hits
}

function assertNoImports(file: string, forbiddenPrefixes: string[]) {
  const violations = importsIn(file).filter((imp) => forbiddenPrefixes.some((p) => imp.startsWith(p)))
  assert.deepEqual(
    violations.map((v) => `${file}: ${v}`),
    [],
    file,
  )
}

const clickerApplication = [
  "application/clicker-audio.ts",
  "application/clicker-bgm-engine.ts",
]

const clickerDomain = [
  "domain/services/clicker-bgm.ts",
  "domain/services/clicker-ui-lang.ts",
]

test("clicker application modules do not import infrastructure, hooks, or components", () => {
  for (const rel of clickerApplication) {
    assertNoImports(join(ROOT, rel), ["@/infrastructure/", "@/hooks/", "@/components/"])
  }
})

test("clicker domain modules do not import outer layers", () => {
  for (const rel of clickerDomain) {
    assertNoImports(join(ROOT, rel), [
      "@/application/",
      "@/infrastructure/",
      "@/hooks/",
      "@/components/",
    ])
  }
})

test("clicker UI modules reach persistence only through application", () => {
  const appOnly = join(ROOT, "components/clicker/clicker-app.tsx")
  const infraHits = importsIn(appOnly).filter((imp) => imp.startsWith("@/infrastructure/"))
  assert.deepEqual(infraHits, [])
})
