/**
 * Production smoke: next start + headless Chromium, assert the clicker shell renders without page errors.
 * Requires `npm run build` first (CI runs build before this script).
 */
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { once } from "node:events"
import { createConnection } from "node:net"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"

const HOST = "127.0.0.1"
const PORT = Number(process.env.CLICKER_SMOKE_PORT || "3099")
const BASE = `http://${HOST}:${PORT}`
const ROOT = fileURLToPath(new URL("..", import.meta.url))
const NEXT_BIN = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url))

function waitForPort(host, port, server, timeoutMs = 120_000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    let settled = false
    let timeout
    const cleanup = () => {
      clearTimeout(timeout)
      server.off("error", fail)
      server.off("exit", onExit)
    }
    const fail = (error) => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    }
    const onExit = (code, signal) => {
      fail(new Error(`Next.js server exited before listening (code ${code}, signal ${signal})`))
    }
    const tick = () => {
      if (settled) return
      const socket = createConnection({ host, port }, () => {
        settled = true
        socket.end()
        cleanup()
        resolve()
      })
      socket.on("error", () => {
        socket.destroy()
        if (Date.now() - start > timeoutMs) fail(new Error(`Timed out waiting for ${host}:${port}`))
        else setTimeout(tick, 250)
      })
    }
    server.once("error", fail)
    server.once("exit", onExit)
    timeout = setTimeout(() => fail(new Error(`Timed out waiting for ${host}:${port}`)), timeoutMs)
    tick()
  })
}

test("production clicker home loads without client exceptions", { timeout: 180_000 }, async () => {
  const server = spawn(
    process.execPath,
    [NEXT_BIN, "start", "--hostname", HOST, "--port", String(PORT)],
    {
      cwd: ROOT,
      env: { ...process.env, NODE_ENV: "production" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  )

  const pageErrors = []
  let browser
  try {
    await waitForPort(HOST, PORT, server)
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    page.on("pageerror", (err) => {
      pageErrors.push(err instanceof Error ? err.message : String(err))
    })

    const response = await page.goto(BASE, { waitUntil: "networkidle", timeout: 60_000 })
    assert.ok(response?.ok(), `HTTP ${response?.status()}`)

    await page.waitForSelector("[data-clicker]", { timeout: 30_000 })
    const bodyText = await page.locator("body").innerText()
    assert.ok(!/This page couldn't load/i.test(bodyText), "error overlay visible")
    assert.deepEqual(pageErrors, [], `pageerror: ${pageErrors.join("; ")}`)
  } finally {
    if (browser) await browser.close().catch(() => {})
    server.kill("SIGTERM")
    await Promise.race([once(server, "exit"), new Promise((r) => setTimeout(r, 5000))])
  }
})
