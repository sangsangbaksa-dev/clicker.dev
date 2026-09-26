import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"
import test from "node:test"

const SRC = join(import.meta.dirname, "../..")

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".test.ts") ? [path] : []
  })
}

test("server code never fires a promise without handling its rejection", () => {
  const offenders: string[] = []
  for (const dir of ["infrastructure", "application", "app/api"]) {
    for (const file of sourceFiles(join(SRC, dir))) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
          if (/^\s*void\s+[\w.]+\(/.test(line)) {
            offenders.push(`${relative(SRC, file)}:${index + 1}`)
          }
        })
    }
  }
  assert.deepEqual(offenders, [], "`void promise()`는 실패가 처리되지 않습니다. .catch(...)로 오류를 기록하세요.")
})

test("the app has error boundaries so a render error never blanks the site", () => {
  for (const name of ["error.tsx", "global-error.tsx"]) {
    const path = join(SRC, "app", name)
    assert.ok(existsSync(path), `src/app/${name} is missing`)
    const source = readFileSync(path, "utf8")
    assert.match(source, /^"use client"/)
    assert.match(source, /retry\(\)/)
  }
})
