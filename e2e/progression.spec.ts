import { expect, test } from "@playwright/test"
import { grantCore, readSave, reloadWithSave, saveNow, startNewGame } from "./helpers"

const ALL_WORLDLINES = ["focus_line", "auto_line", "reso_line", "risk_line", "hybrid_line"]

test("reaching the threshold folds the worldline into a rebirth", async ({ page }) => {
  await startNewGame(page)
  await grantCore(page, 1)
  await page.getByRole("button", { name: "TRANSCENDENCE 열기" }).click()
  await page.getByRole("button", { name: "Directive Pulse · 이 선으로 접기" }).click()

  await expect.poll(async () => (await readSave(page)).metaState.rebirthCount, { timeout: 30_000 }).toBe(1)
  const save = await saveNow(page)
  expect(save.metaState.transcendenceIds).toEqual(["focus_line"])
  expect(save.runState.producerLevels.solar_node).toBe(0)
  expect(save.settings.playSurface).toBe("hub")
})

test("after all five worldlines the AURELIA Protocol ends the game, and a new record starts over", async ({ page }) => {
  await startNewGame(page)
  // Straight after the fifth rebirth: every line walked, the next threshold far away.
  await reloadWithSave(page, (save) => {
    save.metaState.rebirthCount = ALL_WORLDLINES.length
    save.metaState.transcendenceIds = ALL_WORLDLINES
    save.runState.lifetimeCoreEnergy = 0
  })

  await page.getByRole("button", { name: "TRANSCENDENCE 열기" }).click()
  await page.getByRole("button", { name: /AURELIA Protocol 열기/ }).click()
  for (let step = 0; step < 3; step++) await page.getByRole("button", { name: /^다음 단계/ }).click()
  await page.getByRole("button", { name: "실행 확인" }).click()
  await page.getByRole("button", { name: /^Protocol 실행/ }).click()

  await expect(page.getByRole("button", { name: "새 기록 시작" })).toBeVisible()
  expect((await readSave(page)).metaState.gameCompleted).toBe(true)

  // The closed record stays closed across reloads.
  await page.reload()
  await expect(page.getByRole("button", { name: "새 기록 시작" })).toBeVisible()

  await page.getByRole("button", { name: "새 기록 시작" }).click()
  await page.getByRole("button", { name: "세이브를 삭제하고 새 기록을 시작합니다" }).click()
  await expect(page.getByRole("button", { name: /시작하기/ })).toBeVisible()
  const fresh = await readSave(page)
  expect(fresh.metaState.gameCompleted).toBe(false)
  expect(fresh.metaState.rebirthCount).toBe(0)
})

test("the Protocol stays hidden until every worldline is walked", async ({ page }) => {
  await startNewGame(page)
  await grantCore(page, 1)
  await page.getByRole("button", { name: "TRANSCENDENCE 열기" }).click()
  await expect(page.getByRole("button", { name: /이 선으로 접기/ }).first()).toBeVisible()
  await expect(page.getByRole("button", { name: /AURELIA Protocol 열기/ })).toHaveCount(0)
})
