import type { SaveData } from "../entities/clicker.ts"
import { isLiveMineSession, pauseMine, resumeMine } from "./clicker-mine-pause.ts"

export type ClickerScreenTabId = "mine" | "upgrades" | "skills" | "shop" | "rebirth"

export type ScreenTabDef = {
  id: ClickerScreenTabId
  labelEn: string
  labelKo: string
}

export type ManageDrawerTabId = "upgrades" | "shop" | "transcendence"

export function buildScreenTabs(opts: { showRebirth: boolean }): ScreenTabDef[] {
  const tabs: ScreenTabDef[] = [
    { id: "mine", labelEn: "Mine", labelKo: "광산" },
    { id: "upgrades", labelEn: "Upgrades", labelKo: "업그레이드" },
    { id: "skills", labelEn: "Skills", labelKo: "스킬" },
    { id: "shop", labelEn: "Shop", labelKo: "상점" },
  ]
  if (opts.showRebirth) {
    tabs.push({ id: "rebirth", labelEn: "Rebirth", labelKo: "초월" })
  }
  return tabs
}

export function manageTabForScreen(tab: ClickerScreenTabId): ManageDrawerTabId | null {
  if (tab === "upgrades") return "upgrades"
  if (tab === "shop") return "shop"
  if (tab === "rebirth") return "transcendence"
  return null
}

/** Only one primary screen; mine chamber mounts on Mine tab during a live session. */
export function shouldMountMineChamber(screenTab: ClickerScreenTabId, save: SaveData, now: number): boolean {
  return screenTab === "mine" && isLiveMineSession(save, now)
}

export function shouldShowManageScreen(screenTab: ClickerScreenTabId): boolean {
  return screenTab === "upgrades" || screenTab === "shop" || screenTab === "rebirth"
}

export function selectScreenTab(
  save: SaveData,
  from: ClickerScreenTabId,
  to: ClickerScreenTabId,
  now: number,
): { save: SaveData; openSkillTree: boolean; manageTab: ManageDrawerTabId | null } {
  if (from === to) {
    return { save, openSkillTree: to === "skills", manageTab: manageTabForScreen(to) }
  }
  let next = save
  if (from === "mine" && to !== "mine") {
    next = pauseMine(next, now)
  }
  if (to === "mine") {
    next = resumeMine(next, now)
  }
  return {
    save: next,
    openSkillTree: to === "skills",
    manageTab: manageTabForScreen(to),
  }
}
