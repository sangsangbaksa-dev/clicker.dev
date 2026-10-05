/**
 * GitHub Pages smoke: serve `out/` with a project-site base path (like github.io/<repo>/),
 * then assert the exported clicker shell hydrates without client exceptions.
 *
 * Run after: prepare-pages.sh + GITHUB_PAGES=1 next build (see .github/workflows/pages.yml).
 */
import assert from "node:assert/strict"
import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import { join, extname } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"

const HOST = "127.0.0.1"
const PORT = Number(process.env.CLICKER_PAGES_SMOKE_PORT || "3098")
const BASE_PATH = process.env.PAGES_BASE_PATH || "/clicker.dev"
const ROOT = fileURLToPath(new URL("../out", import.meta.url))
const ORIGIN = `http://${HOST}:${PORT}`

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".svg": "image/svg+xml",
}

/** Mimic GitHub project pages: URL path includes the repo segment; files live at `out/` root. */
function createPagesServer() {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", ORIGIN)
      let pathname = url.pathname
      if (BASE_PATH && pathname.startsWith(BASE_PATH)) {
        pathname = pathname.slice(BASE_PATH.length) || "/"
      }
      if (!pathname.startsWith("/")) pathname = `/${pathname}`

      let filePath = join(ROOT, pathname)
      if (pathname.endsWith("/")) filePath = join(filePath, "index.html")
      let body
      try {
        body = await readFile(filePath)
      } catch {
        if (!extname(pathname)) {
          body = await readFile(join(ROOT, "404.html"))
          res.statusCode = 404
        } else {
          res.statusCode = 404
          res.end("Not found")
          return
        }
      }
      const type = MIME[extname(filePath)] ?? "application/octet-stream"
      res.setHeader("content-type", type)
      res.end(body)
    } catch (err) {
      res.statusCode = 500
      res.end(String(err))
    }
  })
}

test("exported clicker loads under Pages base path", { timeout: 120_000 }, async () => {
  const server = createPagesServer()
  await new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(PORT, HOST, resolve)
  })

  const pageErrors = []
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    page.on("pageerror", (err) => {
      pageErrors.push(err instanceof Error ? err.message : String(err))
    })
    page.on("requestfailed", (req) => {
      const u = req.url()
      if (u.includes("/api/clicker")) {
        pageErrors.push(`requestfailed: ${u}`)
      }
    })

    const entry = `${ORIGIN}${BASE_PATH}/`
    const response = await page.goto(entry, { waitUntil: "networkidle", timeout: 60_000 })
    assert.ok(response?.ok(), `HTTP ${response?.status()}`)

    await page.waitForSelector("[data-clicker]", { timeout: 30_000 })
    const bodyText = await page.locator("body").innerText()
    assert.ok(!/This page couldn't load/i.test(bodyText), "error overlay visible")
    assert.deepEqual(pageErrors, [], `client errors: ${pageErrors.join("; ")}`)
  } finally {
    if (browser) await browser.close().catch(() => {})
    await new Promise((resolve) => server.close(() => resolve()))
  }
})
