import type { UpgradeCategory } from "../entities/clicker.ts"

/** Pill tabs above the upgrade list: four upgrade filters, then three routes to existing screens. */
export type UpgradeNavTabId = UpgradeCategory | "MONSTER" | "REBIRTH" | "DRILL"

/** What the hub stage currently shows (mirrors the stage branches in clicker-app). */
export type StageStation = "mine" | "boss" | "hunt" | "drill"

export type UpgradeNavTabDef = {
  id: UpgradeNavTabId
  /** Single source of the visible label. */
  label: string
  /** Optional shorter visible text (e.g. "시추"); aria-label keeps the full label. Setting it is a one-line change. */
  shortLabel?: string
  /** Optional aria-label override; defaults to `label`. */
  ariaLabel?: string
  order: number
  kind: "category" | "route"
}

export const UPGRADE_NAV_TABS: readonly UpgradeNavTabDef[] = [
  { id: "CLICK", label: "채굴", ariaLabel: "채굴 업그레이드", order: 0, kind: "category" },
  { id: "PRODUCTION", label: "생산", ariaLabel: "생산 업그레이드", order: 1, kind: "category" },
  { id: "FEVER", label: "FEVER", ariaLabel: "FEVER 업그레이드", order: 2, kind: "category" },
  { id: "UTILITY", label: "유틸", ariaLabel: "유틸 업그레이드", order: 3, kind: "category" },
  { id: "MONSTER", label: "몬스터", order: 4, kind: "route" },
  { id: "REBIRTH", label: "환생", order: 5, kind: "route" },
  { id: "DRILL", label: "코어 시추", order: 6, kind: "route" },
]

export type UpgradeNavTab = UpgradeNavTabDef & {
  enabled: boolean
  /** Why a route pill is unavailable right now (shown as refusal text / title). */
  disabledReason?: string
}

export type UpgradeNavAction =
  | { kind: "filter"; category: UpgradeCategory }
  | { kind: "open-stage" }
  | { kind: "open-rebirth" }

export function stageStationFor(opts: {
  inMine: boolean
  isHome: boolean
  hasBoss: boolean
  huntMode: boolean
  hasMonster: boolean
}): StageStation {
  if (opts.inMine || opts.isHome) return "mine"
  if (opts.hasBoss) return "boss"
  if (opts.huntMode && opts.hasMonster) return "hunt"
  return "drill"
}

export function buildUpgradeNavTabs(ctx: { station: StageStation; rebirthVisible: boolean }): UpgradeNavTab[] {
  return [...UPGRADE_NAV_TABS]
    .sort((a, b) => a.order - b.order)
    .map((def): UpgradeNavTab => {
      if (def.id === "MONSTER") {
        const ok = ctx.station === "boss" || ctx.station === "hunt"
        return ok ? { ...def, enabled: true } : { ...def, enabled: false, disabledReason: "이 지역에는 몬스터가 없습니다. 지역 탭에서 이동하세요." }
      }
      if (def.id === "DRILL") {
        const ok = ctx.station === "drill"
        return ok ? { ...def, enabled: true } : { ...def, enabled: false, disabledReason: "코어 시추는 광산 밖 지역에서만 쓸 수 있습니다." }
      }
      if (def.id === "REBIRTH") {
        return ctx.rebirthVisible ? { ...def, enabled: true } : { ...def, enabled: false, disabledReason: "아직 해금되지 않았습니다!" }
      }
      return { ...def, enabled: true }
    })
}

export function upgradeNavAction(id: UpgradeNavTabId): UpgradeNavAction {
  if (id === "MONSTER" || id === "DRILL") return { kind: "open-stage" }
  if (id === "REBIRTH") return { kind: "open-rebirth" }
  return { kind: "filter", category: id }
}

/** Visible pill text: shortLabel when set, otherwise the full label. */
export function upgradeNavLabel(tab: Pick<UpgradeNavTabDef, "label" | "shortLabel">): string {
  return tab.shortLabel ?? tab.label
}
