"use client"

import { WORLDLINE_RULE_ICON_DIR, worldlineRuleText, type WorldlineRuleDef } from "@/application/clicker-ui"

/** This worldline's rule: icon + name + the "+" and "−" lines as text (never colour or icon only). */
export function ClickerWorldlineRule({ rule }: { rule: WorldlineRuleDef | null }) {
  if (!rule) return null
  return (
    <section className="clicker-worldline-rule" aria-label={`세계선 규칙: ${worldlineRuleText(rule)}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- small static icon */}
      <img src={`${WORLDLINE_RULE_ICON_DIR}${rule.icon}.webp`} alt="" width={40} height={40} aria-hidden />
      <div>
        <strong>세계선 규칙 · {rule.name}</strong>
        <p>
          <span>{rule.plus}</span> <span>{rule.minus}</span>
        </p>
      </div>
    </section>
  )
}
