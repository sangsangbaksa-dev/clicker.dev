import { expect, type Page } from "@playwright/test"

export const SAVE_KEY = "aurelia-clicker-save-v1"

// Loose view of the save; the e2e suite only reads a few fields.
export type SaveJson = {
  settings: { playSurface: string; gameStarted: boolean }
  runState: {
    coreEnergy: number
    lifetimeCoreEnergy: number
    currentRegionId: string
    crisisActive: boolean
    instability: number
    producerLevels: Record<string, number>
    fever: { phase: string }
  }
  metaState: {
    rebirthCount: number
    transcendenceIds: string[]
    gameCompleted: boolean
    achievementIds: string[]
  }
} & Record<string, unknown>

/** The save as last written to localStorage (autosave runs every 2.5 s; actions like travel write at once). */
export async function readSave(page: Page): Promise<SaveJson> {
  const raw = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY)
  expect(raw, "a save should exist").not.toBeNull()
  return JSON.parse(raw!) as SaveJson
}

/** Force a write (the top-bar save button) and read it back. */
export async function saveNow(page: Page): Promise<SaveJson> {
  await page.getByRole("button", { name: /탭하여 (지금|다시) 저장/ }).click()
  return readSave(page)
}

/** The toast is a dismiss button exposed as a live status region. */
export function toast(page: Page) {
  return page.locator(".clicker-toast .clicker-toast-msg")
}

export async function dismissToast(page: Page) {
  const bar = page.locator(".clicker-toast")
  if (await bar.count()) await bar.first().click()
}

/** Fresh game: title screen → hub. */
export async function startNewGame(page: Page) {
  await page.goto("/")
  await page.getByRole("button", { name: /시작하기/ }).click()
  await expect(page.getByRole("button", { name: /^Enter Mine/ })).toBeVisible()
}

/** Playtest admin panel (dev only): run one cheat, then close the panel. */
export async function admin(page: Page, ...cheats: (string | RegExp)[]) {
  await page.getByRole("button", { name: "임시 관리자 패널 열기" }).click()
  for (const cheat of cheats) await page.getByRole("button", { name: cheat }).click()
  await page.getByRole("button", { name: "패널 닫기 · Esc" }).click()
}

export async function grantCore(page: Page, tenMillions: number) {
  await admin(page, ...Array.from({ length: tenMillions }, () => "+10M CORE"))
}

/**
 * Replace the stored save before the next load (e.g. to jump to late game), then reload.
 * Written from an init script so the old page's pagehide autosave can't overwrite it.
 */
export async function reloadWithSave(page: Page, mutate: (save: SaveJson) => void) {
  const save = await readSave(page)
  mutate(save)
  await page.addInitScript(
    ([key, value]) => {
      if (sessionStorage.getItem("e2e-seeded") === value) return
      localStorage.setItem(key, value)
      sessionStorage.setItem("e2e-seeded", value)
    },
    [SAVE_KEY, JSON.stringify(save)] as const,
  )
  await page.reload()
}

/** Real pointer click at the centre of an element — catches overlays that steal the tap. */
export async function tapCentre(page: Page, name: string | RegExp) {
  const box = await page.getByRole("button", { name }).boundingBox()
  expect(box, `${name} should be on screen`).not.toBeNull()
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
}
