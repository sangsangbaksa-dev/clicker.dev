"use client"

import type { ClickerScreenTabId, ScreenTabDef } from "@/application/clicker-ui"

type Props = {
  tabs: ScreenTabDef[]
  active: ClickerScreenTabId
  mineBadge: string | null
  onSelect: (id: ClickerScreenTabId) => void
}

export function ClickerScreenNav({ tabs, active, mineBadge, onSelect }: Props) {
  return (
    <nav className="clicker-screen-nav" aria-label="메인 화면">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`clicker-screen-nav-btn${active === tab.id ? " is-active" : ""}`}
          aria-current={active === tab.id ? "page" : undefined}
          aria-label={tab.labelKo}
          onClick={() => onSelect(tab.id)}
        >
          <span className="clicker-screen-nav-en">{tab.labelEn}</span>
          <span className="clicker-screen-nav-ko">{tab.labelKo}</span>
          {tab.id === "mine" && mineBadge ? (
            <span className="clicker-screen-nav-badge">{mineBadge}</span>
          ) : null}
        </button>
      ))}
    </nav>
  )
}
