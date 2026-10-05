"use client"

import "./clicker-upgrade-nav.css"
import type { UpgradeNavTab, UpgradeNavTabId } from "@/application/clicker-ui"
import { upgradeNavLabel } from "@/application/clicker-ui"
import { navTabCue } from "@/application/clicker-cues"

type Props = {
  tabs: UpgradeNavTab[]
  /** Active upgrade filter; route tabs never stay selected. */
  active: UpgradeNavTabId
  onSelect: (tab: UpgradeNavTab) => void
}

/** Pill tab strip: renders the tab definitions as-is; behaviour lives in the caller. */
export function ClickerUpgradeNav({ tabs, active, onSelect }: Props) {
  return (
    <div className="clicker-buy clicker-upgrades-cats" role="tablist" aria-label="업그레이드 카테고리">
      {tabs.map((tab) => {
        const selected = active === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-disabled={tab.enabled ? undefined : true}
            aria-label={tab.ariaLabel ?? tab.label}
            // An open route pill plays its own cue (upgrades panel); the generic click would double it.
            data-sfx={tab.enabled && navTabCue(tab.id) ? "off" : undefined}
            title={tab.enabled ? undefined : tab.disabledReason}
            className={`${selected ? "clicker-primary" : "clicker-ghost"}${tab.enabled ? "" : " is-locked"}`}
            onClick={() => onSelect(tab)}
          >
            {upgradeNavLabel(tab)}
          </button>
        )
      })}
    </div>
  )
}
