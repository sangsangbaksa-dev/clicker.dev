/**
 * Production smoke: next start + headless Chromium, assert the clicker shell renders without page errors.
 * Requires `npm run build` first (CI runs build before this script).
 */
import { spawn } from "node:child_process"
import { once } from "node:events"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import {
  assertClickerShellReady,
  attachClickerSmokeListeners,
  waitForPort,
  withHeadlessChromium,
} from "./clicker-smoke-helpers.mjs"

const HOST = "127.0.0.1"
const PORT = Number(process.env.CLICKER_SMOKE_PORT || "3099")
const BASE = `http://${HOST}:${PORT}`
const ROOT = fileURLToPath(new URL("..", import.meta.url))
const NEXT_BIN = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url))

test("production clicker home loads without client exceptions", { timeout: 180_000 }, async () => {
  const server = spawn(process.execPath, [NEXT_BIN, "start", "--hostname", HOST, "--port", String(PORT)], {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  })

  try {
    await waitForPort(HOST, PORT, server)
    await withHeadlessChromium(async (page) => {
      const pageErrors = []
      attachClickerSmokeListeners(page, pageErrors)
      await assertClickerShellReady(page, BASE, pageErrors)
    })
  } finally {
    server.kill("SIGTERM")
    await Promise.race([once(server, "exit"), new Promise((r) => setTimeout(r, 5000))])
  }
})
