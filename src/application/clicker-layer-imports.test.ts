import assert from "node:assert/strict"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const srcRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..")

type Rule = { files: string[]; forbidden: RegExp[]; label: string }

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    const st = statSync(path)
    if (st.isDirectory()) out.push(...walk(path))
    else if (name.endsWith(".ts") || name.endsWith(".tsx")) out.push(path)
  }
  return out
}

function importsFrom(file: string): string[] {
  const text = readFileSync(file, "utf8")
  const found: string[] = []
  const re = /from\s+["'](@\/[^"']+)["']/g
  for (let m = re.exec(text); m; m = re.exec(text)) found.push(m[1]!)
  return found
}

function clickerDomainFiles(): string[] {
  const entities = join(srcRoot, "domain/entities/clicker.ts")
  const services = walk(join(srcRoot, "domain/services")).filter((f) => /clicker/i.test(f))
  return [entities, ...services]
}

function clickerApplicationFiles(): string[] {
  const appDir = join(srcRoot, "application")
  const ports = walk(join(appDir, "ports")).filter((f) => /clicker/i.test(f))
  const root = readdirSync(appDir)
    .filter((n) => n.startsWith("clicker") && (n.endsWith(".ts") || n.endsWith(".tsx")))
    .map((n) => join(appDir, n))
    .filter(
      (f) =>
        !f.endsWith(".test.ts") &&
        !f.endsWith("clicker-ui.ts") &&
        !f.endsWith("clicker-display.ts") &&
        !f.endsWith("clicker-bgm-client-bind.ts"),
    )
  return [...ports, ...root]
}

function clickerHookFiles(): string[] {
  return ["use-clicker.ts", "use-clicker-bgm.ts"].map((n) => join(srcRoot, "hooks", n))
}

function clickerComponentFiles(): string[] {
  return walk(join(srcRoot, "components/clicker"))
}

const rules: Rule[] = [
  {
    label: "domain clicker",
    files: clickerDomainFiles(),
    forbidden: [/^@\/application\//, /^@\/infrastructure\//, /^@\/components\//, /^@\/hooks\//, /^@\/data\//],
  },
  {
    label: "application clicker (except UI facade)",
    files: clickerApplicationFiles(),
    forbidden: [/^@\/infrastructure\//, /^@\/components\//, /^@\/hooks\//],
  },
  {
    label: "clicker hooks",
    files: clickerHookFiles(),
    forbidden: [/^@\/infrastructure\//, /^@\/components\//, /^@\/domain\//],
  },
  {
    label: "clicker components",
    files: clickerComponentFiles(),
    forbidden: [/^@\/infrastructure\//, /^@\/domain\//],
  },
]

test("clicker layer import boundaries", () => {
  const violations: string[] = []
  for (const rule of rules) {
    for (const file of rule.files) {
      for (const imp of importsFrom(file)) {
        if (rule.forbidden.some((re) => re.test(imp))) {
          violations.push(`${rule.label}: ${relative(srcRoot, file)} → ${imp}`)
        }
      }
    }
  }
  assert.deepEqual(violations, [])
})
