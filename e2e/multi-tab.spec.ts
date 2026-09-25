import { expect, test } from "@playwright/test"
import { grantCore, readSave, startNewGame } from "./helpers"

test("a second tab takes over the save and the first one pauses", async ({ context, page }) => {
  await startNewGame(page)

  const second = await context.newPage()
  await second.goto("/")
  await expect(second.getByRole("button", { name: /^Enter Mine/ })).toBeVisible()
  await expect(page.getByRole("dialog", { name: "다른 탭에서 게임이 실행 중입니다" })).toBeVisible()

  // Progress made in the second tab is what the first one picks up on resume.
  await grantCore(second, 1)
  await second.getByRole("button", { name: /탭하여 (지금|다시) 저장/ }).click()
  expect((await readSave(second)).runState.coreEnergy).toBeGreaterThanOrEqual(10_000_000)

  await page.getByRole("button", { name: "이 탭에서 계속하기" }).click()
  await expect(page.getByLabel(/^CORE 에너지 1\d(\.\d+)?M/)).toBeVisible()
  await expect(second.getByRole("dialog", { name: "다른 탭에서 게임이 실행 중입니다" })).toBeVisible()
})
