import { expect, test } from "@playwright/test"
import { dismissToast, grantCore, readSave, saveNow, startNewGame, toast } from "./helpers"

test("unlocked regions can be visited and their activity used", async ({ page }) => {
  await startNewGame(page)
  await page.getByRole("button", { name: "지역 화면 열기" }).click()
  await expect(page.getByRole("button", { name: /^Signal Relay 잠김/ })).toBeDisabled()

  await grantCore(page, 1)
  await page.getByRole("button", { name: "Signal Relay(으)로 이동" }).click()
  expect((await readSave(page)).runState.currentRegionId).toBe("signal_relay")

  await page.getByRole("button", { name: /돌아가기 · Esc$/ }).first().click()
  await dismissToast(page)
  await page.getByRole("button", { name: /^주파수 증폭/ }).click()
  await expect(toast(page)).toContainText("주파수 증폭 발동")

  await page.getByRole("button", { name: "Core Mine으로 돌아가기" }).click()
  await expect(page.getByRole("button", { name: /^Enter Mine/ })).toBeVisible()
  expect((await saveNow(page)).runState.currentRegionId).toBe("core_chamber")
})

test("leaving a field challenge after one lucky hit does not pay a perfect run", async ({ page }) => {
  await startNewGame(page)
  await grantCore(page, 3)
  await page.getByRole("button", { name: "지역 화면 열기" }).click()
  await page.getByRole("button", { name: "Storm Spire(으)로 이동" }).click()
  await page.getByRole("button", { name: /돌아가기 · Esc$/ }).first().click()
  await dismissToast(page)

  await page.getByRole("button", { name: /^피뢰침 포획/ }).click()
  const charged = page.getByRole("button", { name: /충전됨/ })
  await charged.first().waitFor()
  await charged.first().dispatchEvent("pointerdown")
  await page.getByRole("button", { name: /여기서 끝내기/ }).click()

  await expect(toast(page)).toContainText("도전 완료 · 성공률")
  const pct = Number((await toast(page).textContent())!.match(/성공률 (\d+)%/)![1])
  expect(pct).toBeLessThan(20)
})
