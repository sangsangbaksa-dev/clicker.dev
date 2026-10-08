"use client"

import type { CSSProperties } from "react"
import type { GuardianLayout } from "@/application/clicker-guardian-frame"

type Props = {
  layout: GuardianLayout
  /** 각성 수호자 placeholder. */
  awakened?: boolean
}

export function GuardianSprite({ layout, awakened = false }: Props) {
  const { art } = layout
  const size = Math.min(art.width, art.height)
  const boxStyle: CSSProperties = {
    left: art.left + (art.width - size) / 2,
    top: art.groundY - size,
    width: size,
    height: size,
  }

  return (
    <div className="guardian-ground" aria-hidden>
      <div className={`guardian-placeholder${awakened ? " is-awakened" : ""}`} style={boxStyle} />
    </div>
  )
}
