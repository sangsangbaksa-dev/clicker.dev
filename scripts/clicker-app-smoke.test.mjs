/**
 * Production smoke: next start + headless Chromium, assert the clicker shell renders without page errors.
 * Requires `npm run build` first (CI runs build before this script).
 */
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { once } from "node:events"
import { createConnection } from "node:net"
import { test } from "node:test"
import { chromium } from "playwright"

const HOST = "127.0.0.1"
const PORT = Number(process.env.CLICKER_SMOKE_PORT || "3099")
const BASE = `http://${HOST}:${PORT}`

function waitForPort(host, port, timeoutMs = 120_000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tick = () => {
      const socket = createConnection({ host, port }, () => {
        socket.end()
        resolve()
      })
      socket.on("error", () => {
        socket.destroy()
        if (Date.now() - start > timeoutMs) reject(new Error(`Timed out waiting for ${host}:${port}`))
        else setTimeout(tick, 250)
      })
    }
    tick()
  })
}

function killServer(server) {
  if (!server?.pid) return
  try {
    server.kill("SIGKILL")
  } catch {
    /* already exited */
  }
}

test("production clicker home loads without client exceptions", { timeout: 180_000 }, async () => {
  const server = spawn(
    "npx",
    ["next", "start", "--hostname", HOST, "--port", String(PORT)],
    {
      cwd: new URL("..", import.meta.url).pathname,
      env: { ...process.env, NODE_ENV: "production" },
      // Do not pipe stdout/stderr — an unread pipe can block `next start` on CI.
      stdio: "ignore",
      detached: process.platform !== "win32",
    },
  )

  const pageErrors = []
  let browser
  try {
    await waitForPort(HOST, PORT)
    browser = await chromium.launch({
      headless: true,
      timeout: 60_000,
      args: process.env.CI ? ["--no-sandbox", "--disable-setuid-sandbox"] : [],
    })
    const page = await browser.newPage()
    page.setDefaultNavigationTimeout(60_000)
    page.setDefaultTimeout(30_000)
    page.on("pageerror", (err) => {
      pageErrors.push(err instanceof Error ? err.message : String(err))
    })

    const response = await page.goto(BASE, { waitUntil: "load", timeout: 60_000 })
    assert.ok(response?.ok(), `HTTP ${response?.status()}`)

    await page.waitForSelector("[data-clicker]", { timeout: 30_000 })
    const bodyText = await page.locator("body").innerText()
    assert.ok(!/This page couldn't load/i.test(bodyText), "error overlay visible")
    assert.deepEqual(pageErrors, [], `pageerror: ${pageErrors.join("; ")}`)
  } finally {
    if (browser) await browser.close().catch(() => {})
    killServer(server)
    if (server.detached && server.pid) {
      try {
        process.kill(-server.pid, "SIGKILL")
      } catch {
        /* process group already gone */
      }
    }
    await Promise.race([once(server, "exit"), new Promise((r) => setTimeout(r, 3000))])
  }
})
