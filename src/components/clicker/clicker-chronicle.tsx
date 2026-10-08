"use client"

import { formatNumber, worldlineDurationMs } from "@/application/clicker-ui"
import type { ClickerGame } from "./panels/types"

function minutes(ms: number): string {
  const m = Math.round(ms / 60000)
  return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`
}

/** 기록실: one row per finished worldline, and the "나의 세계선" summary after the ending. */
export function ClickerChronicle({ game }: { game: ClickerGame }) {
  const data = game.chronicle
  if (!data) return null
  const { entries, summary } = data
  const buffName = (id: string | null) =>
    id ? game.config.transcendence.find((t) => t.id === id)?.name ?? id : "코어 하트 (엔딩)"
  return (
    <section className="clicker-chronicle" aria-labelledby="clicker-chronicle-title">
      <h3 id="clicker-chronicle-title" className="clicker-world-title">기록실</h3>
      {entries.length === 0 ? (
        <p className="clicker-achievements-lead">세계선을 하나 끝내면 여기에 기록이 남아요.</p>
      ) : (
        <>
          {summary.complete ? (
            <p className="clicker-achievements-lead" role="status">
              나의 {summary.worldlines}세계선 · 총 <strong>{minutes(summary.totalMs)}</strong> 동안 걸었어요. 최고 콤보는{" "}
              <strong>{formatNumber(summary.bestCombo)}</strong>예요.
            </p>
          ) : null}
          <table className="clicker-chronicle-table">
            <caption style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>세계선별 기록: 걸린 시간, 최고 콤보, 고른 초월</caption>
            <thead>
              <tr>
                <th scope="col">세계선</th>
                <th scope="col">걸린 시간</th>
                <th scope="col">최고 콤보</th>
                <th scope="col">고른 초월</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.worldLine}>
                  <th scope="row">{e.worldLine}</th>
                  <td>{minutes(worldlineDurationMs(e))}</td>
                  <td>{formatNumber(e.maxCombo)}</td>
                  <td>{buffName(e.transcendenceId)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  )
}
