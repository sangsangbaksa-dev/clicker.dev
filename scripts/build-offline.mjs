#!/usr/bin/env node
/**
 * After the GitHub Pages static export: write out/offline-manifest.json (the app shell and every
 * game asset with its size) and out/sw.js (scripts/clicker-sw.js with the base path and a build
 * hash), so the installed app runs with no network.
 *
 *   PAGES_BASE_PATH=/clicker.dev node scripts/build-offline.mjs [outDir]
 */
import { createHash } from "node:crypto"
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

const here = fileURLToPath(new URL(".", import.meta.url))
const out = process.argv[2] ?? join(here, "..", "out")
const indexHtml = readFileSync(join(out, "index.html"), "utf8")
// Base path: from the environment, else read off the page's own script URLs ("/<base>/_next/...").
const detected = /(?:src|href)="(\/[^"]*?)\/_next\//.exec(indexHtml)?.[1] ?? ""
const base = (process.env.PAGES_BASE_PATH ?? detected).replace(/\/$/, "")

function walk(dir) {
  const files = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) files.push(...walk(p))
    else files.push({ path: p, size: st.size })
  }
  return files
}

const all = walk(out).map((f) => ({ ...f, rel: relative(out, f.path).split(sep).join("/") }))
const url = (rel) => `${base}/${rel}`

// Shell: the page, its scripts and styles, the manifest and the icon — enough to boot offline.
const shell = [`${base}/`]
for (const f of all) {
  if (f.rel === "index.html" || f.rel === "404.html" || f.rel.startsWith("_next/static/") || f.rel === "manifest.webmanifest") {
    shell.push(url(f.rel))
  }
}
shell.push(url("clicker/icon/icon_core.png"))

// Assets: everything the game loads from /clicker/ (images, videos, audio).
const assets = all
  .filter((f) => f.rel.startsWith("clicker/") && f.rel !== "clicker/icon/icon_core.png")
  .map((f) => ({ url: url(f.rel), size: f.size }))
const total = assets.reduce((n, a) => n + a.size, 0)

// Fonts come from Google Fonts; the worker caches the stylesheet and its files on download.
const fonts = [...new Set([...indexHtml.matchAll(/href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&")))]

const hash = createHash("sha256")
for (const f of all.filter((f) => f.rel.endsWith(".html") || f.rel.startsWith("_next/static/"))) {
  hash.update(f.rel)
  hash.update(readFileSync(f.path))
}
for (const a of assets) hash.update(`${a.url}:${a.size}`)
const version = hash.digest("hex").slice(0, 12)

writeFileSync(join(out, "offline-manifest.json"), JSON.stringify({ version, shell, assets, total, fonts }))
const sw = readFileSync(join(here, "clicker-sw.js"), "utf8").replaceAll("__BASE__", base).replaceAll("__VERSION__", version)
writeFileSync(join(out, "sw.js"), sw)
console.log(`offline: version ${version}, shell ${shell.length} files, ${assets.length} assets (${(total / 1048576).toFixed(1)} MB)`)
