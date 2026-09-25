import { expect, test } from "@playwright/test"
import { dismissToast, grantCore, readSave, saveNow, startNewGame, toast } from "./helpers"

test("title screen starts a new game on the mine entrance hub", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByText("AURELIA")).toBeVisible()
  await page.getByRole("button", { name: /시작하기/ }).click()
  await expect(page.getByRole("button", { name: /^Enter Mine/ })).toBeVisible()
  const save = await saveNow(page)
  expect(save.settings.gameStarted).toBe(true)
  expect(save.settings.playSurface).toBe("hub")
})

test("a mine session earns CORE, ends on its own and shows the haul", async ({ page }) => {
  await startNewGame(page)
  await page.getByRole("button", { name: /^Enter Mine/ }).click()
  const ore = page.getByRole("button", { name: /코어 광석 채굴/ })
  await expect(ore).toBeVisible()

  // Mine until the 10 s session closes itself.
  const result = page.getByRole("dialog", { name: /채굴 종료|최고 기록 갱신/ })
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline && (await ore.isVisible())) {
    await ore.dispatchEvent("pointerdown").catch(() => {})
    await page.waitForTimeout(50)
  }
  await expect(result).toBeVisible()
  await page.getByRole("button", { name: "확인" }).click()

  // Back at the hub, with a re-entry cooldown and the haul in the bank.
  await expect(page.getByRole("button", { name: /Enter Mine · 재입장 대기/ })).toBeVisible()
  const save = await saveNow(page)
  expect(save.settings.playSurface).toBe("hub")
  expect(save.runState.coreEnergy).toBeGreaterThan(0)
})

test("progress survives a reload", async ({ page }) => {
  await startNewGame(page)
  await grantCore(page, 1)
  const before = await saveNow(page)
  expect(before.runState.coreEnergy).toBeGreaterThanOrEqual(10_000_000)

  await page.reload()
  await expect(page.getByRole("button", { name: /^Enter Mine/ })).toBeVisible()
  const after = await readSave(page)
  expect(after.runState.coreEnergy).toBeGreaterThanOrEqual(before.runState.coreEnergy)
  await expect(page.getByLabel(/^CORE 에너지 1\d(\.\d+)?M/)).toBeVisible()
})

test("producers, upgrades, skill circuits and shop items can be bought", async ({ page }) => {
  await startNewGame(page)
  await grantCore(page, 1)
  const start = (await saveNow(page)).runState.coreEnergy

  await page.getByRole("button", { name: "생산자 화면 열기" }).click()
  await page.getByRole("button", { name: /^Solar Node ×10/ }).click()
  let save = await saveNow(page)
  expect(save.runState.producerLevels.solar_node).toBe(10)
  expect(save.runState.coreEnergy).toBeLessThan(start)

  await page.getByRole("button", { name: "업그레이드", exact: true }).click()
  await page.getByRole("button", { name: /^구매/ }).first().click()
  await expect(toast(page)).toContainText(/^강화 · /)
  await dismissToast(page)

  await page.getByRole("button", { name: "스킬 회로", exact: true }).click()
  await page.getByRole("button", { name: /^Direct Pulse/ }).click()
  await page.getByRole("button", { name: /CORE로 해금$/ }).click()
  await expect(toast(page)).toContainText("회로 해금 · Direct Pulse")
  await dismissToast(page)

  await page.getByRole("button", { name: "상점", exact: true }).click()
  await page.getByRole("button", { name: /^Time Break Potion 구매/ }).click()
  await expect(page.getByRole("button", { name: /^Time Break Potion 구매 .* 보유 1/ })).toBeVisible()
  await page.getByRole("button", { name: /^CORE PULSE 구매/ }).click()
  await expect(page.getByRole("button", { name: /^CORE PULSE 구매 .* 보유 1/ })).toBeVisible()

  save = await saveNow(page)
  expect(save.runState.coreEnergy).toBeLessThan(start)
})

test("a full FEVER gauge starts FEVER", async ({ page }) => {
  await startNewGame(page)
  await page.getByRole("button", { name: "임시 관리자 패널 열기" }).click()
  await page.getByRole("button", { name: "치트 · FEVER 게이지 충전" }).click()
  await page.getByRole("button", { name: "패널 닫기 · Esc" }).click()
  await expect.poll(async () => (await saveNow(page)).runState.fever.phase).toBe("FEVER")
})
