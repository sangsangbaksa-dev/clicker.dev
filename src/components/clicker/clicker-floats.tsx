"use client"

import { useSyncExternalStore } from "react"
import { getFloats, getServerFloats, subscribeFloats } from "@/lib/clicker-floats"

const STRIKE_LABEL = { quake: "지진파 ", lightning: "번개 ", echo: "잔향 " } as const

/** Hit numbers; subscribes on its own so a click never repaints the whole app. */
export function ClickerFloats() {
  const floats = useSyncExternalStore(subscribeFloats, getFloats, getServerFloats)
  return floats.map((f) => (
    <div
      key={f.id}
      className={`clicker-float ${f.critical ? "is-crit" : ""}${f.strike ? ` is-${f.strike}` : ""}`}
      style={{ left: f.x || "50%", top: f.y || "45%" }}
      aria-hidden
    >
      {f.strike ? STRIKE_LABEL[f.strike] : ""}
      {f.critical ? "치명타 " : ""}
      {f.text}
    </div>
  ))
}
