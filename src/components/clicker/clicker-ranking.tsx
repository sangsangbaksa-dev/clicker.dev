"use client"

import { useEffect, useState } from "react"
import {
  fetchClickerLeaderboard,
  type ClickerLeaderboard,
  type ClickerLeaderboardKind,
  type ClickerLeaderboardRow,
} from "@/application/clicker-account"
import { formatClickerPlayTime, formatNumber } from "@/application/clicker-ui"

type Props = {
  /** Logged in: the board can mark the player's own row. */
  signedIn: boolean
  /** Bump to refetch (e.g. after a fresh upload). */
  refreshKey?: number
  initialKind?: ClickerLeaderboardKind
  worldlineTotal: number
}

type State =
  | { status: "loading" }
  | { status: "unavailable"; text: string }
  | { status: "ready"; board: ClickerLeaderboard }

const TABS: Array<[ClickerLeaderboardKind, string]> = [
  ["clear", "최단 클리어"],
  ["core", "누적 CORE"],
]

/** Online ranking with two boards: fastest true ending, and lifetime CORE. */
export function ClickerRanking({ signedIn, refreshKey = 0, initialKind = "clear", worldlineTotal }: Props) {
  const [kind, setKind] = useState<ClickerLeaderboardKind>(initialKind)
  const [state, setState] = useState<State>({ status: "loading" })

  useEffect(() => {
    let alive = true
    setState({ status: "loading" })
    void fetchClickerLeaderboard(kind).then((r) => {
      if (!alive) return
      if (r.ok) setState({ status: "ready", board: r.value })
      else
        setState({
          status: "unavailable",
          text: r.unavailable ? "이 주소에서는 온라인 랭킹 서버에 연결할 수 없습니다." : r.error,
        })
    })
    return () => {
      alive = false
    }
  }, [kind, refreshKey])

  const meOffBoard = state.status === "ready" && state.board.me && !state.board.top.some((r) => r.isMe) ? state.board.me : null

  return (
    <section className="clicker-ranking" aria-labelledby="clicker-ranking-title">
      <div className="clicker-ranking-head">
        <div>
          <p className="clicker-ranking-kicker">ONLINE RANKING</p>
          <h2 id="clicker-ranking-title">랭킹</h2>
        </div>
        <div className="clicker-ranking-tabs" role="tablist" aria-label="랭킹 종류">
          {TABS.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={kind === id} className={kind === id ? "is-on" : ""} onClick={() => setKind(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {state.status === "loading" ? (
        <p className="clicker-ranking-empty">랭킹을 불러오는 중…</p>
      ) : state.status === "unavailable" ? (
        <p className="clicker-ranking-empty">{state.text}</p>
      ) : state.board.top.length === 0 ? (
        <p className="clicker-ranking-empty">
          {kind === "clear" ? "아직 엔딩을 본 플레이어가 없습니다. 첫 번째 이름이 되어 보세요." : "아직 기록이 없습니다."}
        </p>
      ) : (
        <ol className="clicker-ranking-list">
          {state.board.top.map((row) => (
            <RankingRow key={`${row.rank}-${row.nickname}`} row={row} kind={kind} worldlineTotal={worldlineTotal} />
          ))}
          {meOffBoard ? (
            <>
              <li className="clicker-ranking-gap" aria-hidden>
                ⋮
              </li>
              <RankingRow row={meOffBoard} kind={kind} worldlineTotal={worldlineTotal} />
            </>
          ) : null}
        </ol>
      )}
      <p className="clicker-ranking-foot">
        {state.status === "ready" ? `참가자 ${state.board.total}명 · ` : ""}
        {signedIn
          ? "로그인한 상태로 클라우드에 저장될 때마다 기록이 갱신됩니다."
          : "로그인하면 클라우드 저장과 함께 내 기록이 랭킹에 올라갑니다."}
      </p>
    </section>
  )
}

function RankingRow({ row, kind, worldlineTotal }: { row: ClickerLeaderboardRow; kind: ClickerLeaderboardKind; worldlineTotal: number }) {
  const medal = row.rank === 1 ? "is-gold" : row.rank === 2 ? "is-silver" : row.rank === 3 ? "is-bronze" : ""
  return (
    <li className={`${row.isMe ? "is-me" : ""} ${medal}`.trim()} aria-current={row.isMe ? "true" : undefined}>
      <span className="clicker-ranking-rank">{row.rank}</span>
      <span className="clicker-ranking-name">
        <strong>{row.nickname}</strong>
        <small>
          세계선 {row.worldlinesOwned}/{worldlineTotal} · 환생 {row.rebirthCount}
          {kind === "core" && row.playTimeMs != null ? ` · ${formatClickerPlayTime(row.playTimeMs)}` : ""}
        </small>
      </span>
      <span className="clicker-ranking-score">
        {kind === "clear" ? formatClickerPlayTime(row.clearMs ?? 0) : `${formatNumber(row.totalCore)} CORE`}
      </span>
      {row.isMe ? <span className="clicker-ranking-me">나</span> : null}
    </li>
  )
}
