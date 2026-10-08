/**
 * GitHub Pages smoke: serve `out/` with a project-site base path (like github.io/<repo>/),
 * then assert the exported clicker shell hydrates without client exceptions.
 *
 * Run after: prepare-pages.sh + GITHUB_PAGES=1 next build (see .github/workflows/pages.yml).
 */
import { test } from "node:test"
import { createGitHubPagesStaticServer } from "./clicker-pages-server.mjs"
import {
  assertClickerShellReady,
  attachClickerSmokeListeners,
  withHeadlessChromium,
} from "./clicker-smoke-helpers.mjs"

const HOST = "127.0.0.1"
const PORT = Number(process.env.CLICKER_PAGES_SMOKE_PORT || "3098")
const BASE_PATH = process.env.PAGES_BASE_PATH || "/clicker.dev"

test("exported clicker loads under Pages base path", { timeout: 120_000 }, async () => {
  const { listen, close, origin } = createGitHubPagesStaticServer({
    host: HOST,
    port: PORT,
    basePath: BASE_PATH,
  })
  await listen()

  try {
    await withHeadlessChromium(async (page) => {
      const pageErrors = []
      attachClickerSmokeListeners(page, pageErrors, { forbidClickerApi: true })
      await assertClickerShellReady(page, `${origin}${BASE_PATH}/`, pageErrors)
    })
  } finally {
    await close()
  }
})
