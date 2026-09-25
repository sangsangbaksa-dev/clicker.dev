import { expect, test } from "@playwright/test"
import { admin, grantCore, saveNow, startNewGame, tapCentre, toast } from "./helpers"

const CHOICES = [
  { name: /^안정화/, toast: "안정화" },
  { name: /^위험 감수/, toast: "위험 감수" },
  { name: /^비상 오버클럭/, toast: "비상 오버클럭" },
]

for (const choice of CHOICES) {
  test(`crisis choice "${choice.toast}" is clickable on the mine entrance`, async ({ page }) => {
    await startNewGame(page)
    await admin(page, "치트 · CORE CRISIS 발동")
    await expect(page.getByRole("alertdialog", { name: /CORE CRISIS/ })).toBeVisible()

    // A real tap on the card must reach the choice, not the Enter Mine button behind it.
    await tapCentre(page, choice.name)

    await expect(page.getByRole("alertdialog", { name: /CORE CRISIS/ })).toBeHidden()
    await expect(toast(page)).toContainText(`위기 해소 · ${choice.toast}`)
    const save = await saveNow(page)
    expect(save.runState.crisisActive).toBe(false)
    expect(save.settings.playSurface).toBe("hub")
  })
}

test("crisis can be resolved while away in a region", async ({ page }) => {
  await startNewGame(page)
  await grantCore(page, 1)
  await page.getByRole("button", { name: "지역 화면 열기" }).click()
  await page.getByRole("button", { name: "Signal Relay(으)로 이동" }).click()
  await page.getByRole("button", { name: /돌아가기 · Esc$/ }).first().click()
  await admin(page, "치트 · CORE CRISIS 발동")

  await tapCentre(page, /^안정화/)
  await expect(page.getByRole("alertdialog", { name: /CORE CRISIS/ })).toBeHidden()
  expect((await saveNow(page)).runState.crisisActive).toBe(false)
})
