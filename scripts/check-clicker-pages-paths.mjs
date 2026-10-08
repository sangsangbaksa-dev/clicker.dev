/**
 * GitHub Pages: prepare-pages.sh only rewrites quoted `/clicker/` and `/brand/` asset paths.
 * Scans clicker UI/data/infrastructure sources (not tests or API modules).
 */
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const SRC = join(fileURLToPath(new URL(".", import.meta.url)), "../src")
const QUOTED_ASSET = /["'`](\/(clicker|brand)\/)/
const PUBLIC_ASSET = /\/(clicker|brand)\//

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...walk(path))
    else if (/\.(ts|tsx|css)$/.test(name)) out.push(path)
  }
  return out
}

function shouldScan(file) {
  if (file.includes(".test.")) return false
  if (file.includes("/application/") || file.includes("/hooks/") || file.includes("/domain/")) return false
  if (file.includes("/components/clicker/")) return true
  if (file.includes("/data/clicker/")) return true
  if (file.includes("clicker-bgm-catalog")) return true
  if (file.includes("ore-art.ts")) return true
  if (file.includes("/app/manifest.ts")) return true
  if (file.includes("/app/layout.tsx")) return true
  return false
}

function isViolation(line) {
  if (!PUBLIC_ASSET.test(line)) return false
  const trimmed = line.trim()
  if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/**")) return false
  if (line.includes("@/")) return false
  if (QUOTED_ASSET.test(line)) return false
  return true
}

const violations = []
for (const file of walk(SRC)) {
  if (!shouldScan(file)) continue
  const lines = readFileSync(file, "utf8").split("\n")
  lines.forEach((line, index) => {
    if (isViolation(line)) violations.push(`${file}:${index + 1}: ${line.trim()}`)
  })
}

if (violations.length) {
  console.error("Public /clicker/ or /brand/ paths must use quoted strings for prepare-pages.sh:\n")
  for (const v of violations) console.error(v)
  process.exit(1)
}

console.log("clicker Pages path quoting OK")
