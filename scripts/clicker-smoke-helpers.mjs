/**
 * Shared Playwright helpers for clicker smoke tests.
 */
import assert from "node:assert/strict"
import { createConnection } from "node:net"
import { chromium } from "playwright"

/** Wait until a TCP port accepts connections (Next dev/start smoke). */
export function waitForPort(host, port, server, timeoutMs = 120_000) {
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
      fail(new Error(`Server exited before listening (code ${code}, signal ${signal})`))
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

/** Collect client exceptions; optionally fail on /api/clicker network errors (static host). */
export function attachClickerSmokeListeners(page, pageErrors, { forbidClickerApi = false } = {}) {
  page.on("pageerror", (err) => {
    pageErrors.push(err instanceof Error ? err.message : String(err))
  })
  if (!forbidClickerApi) return
  page.on("requestfailed", (req) => {
    const url = req.url()
    if (url.includes("/api/clicker")) pageErrors.push(`requestfailed: ${url}`)
  })
}

export async function assertClickerShellReady(page, url, pageErrors) {
  const response = await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 })
  assert.ok(response?.ok(), `HTTP ${response?.status()}`)
  await page.waitForSelector("[data-clicker]", { timeout: 30_000 })
  const bodyText = await page.locator("body").innerText()
  assert.ok(!/This page couldn't load/i.test(bodyText), "error overlay visible")
  assert.deepEqual(pageErrors, [], `client errors: ${pageErrors.join("; ")}`)
}

export async function withHeadlessChromium(run) {
  const browser = await chromium.launch({ headless: true })
  try {
    return await run(await browser.newPage())
  } finally {
    await browser.close().catch(() => {})
  }
}
