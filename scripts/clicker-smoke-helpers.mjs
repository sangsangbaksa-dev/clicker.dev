/**
 * Shared Playwright helpers for clicker smoke tests.
 */
import assert from "node:assert/strict"
import { chromium } from "playwright"

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
