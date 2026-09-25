"use client"

import { formatNumber } from "@/domain/services/clicker-format"
import type { MetaState } from "@/domain/entities/clicker"
import type { ClickerGame } from "./types"

export function ClickerAchievementsPanel({ game, meta }: { game: ClickerGame; meta: MetaState }) {
  return (
    <div className="clicker-achievements">
      <p className="clicker-achievements-lead">
        달성 <strong>{game.achievements.filter((a) => a.unlocked).length}</strong>/{game.achievements.length} ·
        생산 보너스 <strong>+{game.achievements.filter((a) => a.unlocked).length}%</strong>
      </p>
      <dl className="clicker-mine-result-stats clicker-records-stats">
        {(
          [
            ["광산 최고", formatNumber(meta.statistics.bestMineHaul)],
            ["광산 입장", formatNumber(meta.statistics.mineSessions)],
            ["광석 파괴", formatNumber(meta.statistics.oresBroken)],
            ["황금 광맥", formatNumber(meta.statistics.veins)],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <ul className="clicker-achievements-grid">
        {game.achievements.map((a) => (
          <li key={a.id} className={`clicker-achievement${a.unlocked ? " is-unlocked" : ""}`}>
            <span className="clicker-achievement-mark" aria-hidden>
              {a.unlocked ? "★" : "☆"}
            </span>
            <div className="clicker-achievement-body">
              <strong>{a.name}</strong>
              <span>{a.description}</span>
              {!a.unlocked ? (
                <div className="clicker-bar" aria-label={`진행 ${Math.round(a.ratio * 100)}%`}>
                  <i style={{ width: `${Math.round(a.ratio * 100)}%` }} />
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
