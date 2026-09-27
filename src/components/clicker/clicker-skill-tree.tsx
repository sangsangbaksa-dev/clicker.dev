"use client"

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import {
  SKILL_BRANCH_COLOR,
  SKILL_BRANCH_GLYPH,
  SKILL_BRANCH_LABEL,
  layoutSkillTree,
  orthogonalPath,
  type SkillCell,
} from "@/data/clicker/skill-tree-layout"
import type { SkillNodeView } from "@/domain/services/clicker-view"
import { formatNumber } from "@/domain/services/clicker-format"

type TreeNode = SkillNodeView & SkillCell

type Props = {
  nodes: SkillNodeView[]
  coreEnergy: number
  onBuy: (id: string) => void
  /** Unlock a circuit with every missing prerequisite in one purchase. */
  onBuyPath: (id: string) => void
}

function statusLabel(status: SkillNodeView["status"]): string {
  switch (status) {
    case "OWNED":
      return "활성"
    case "LOCKED":
      return "잠김"
    case "POOR":
      return "CORE 부족"
    default:
      return "해금 가능"
  }
}

function cellStyle(cell: SkillCell): CSSProperties {
  return {
    left: `calc(var(--cell) * ${cell.col + 0.5})`,
    top: `calc(var(--cell) * ${cell.row + 0.5})`,
  }
}

export function ClickerSkillTree({ nodes, coreEnergy, onBuy, onBuyPath }: Props) {
  // The whole tree is always on the board; locked circuits show dimmed with their prerequisites.
  const layout = useMemo(() => layoutSkillTree(nodes), [nodes])
  const treeNodes = useMemo<TreeNode[]>(
    () => nodes.filter((node) => layout.cells[node.id]).map((node) => ({ ...node, ...layout.cells[node.id] })),
    [layout, nodes],
  )
  const ownedCount = treeNodes.filter((n) => n.status === "OWNED").length
  const lockedCount = treeNodes.filter((n) => n.status === "LOCKED").length

  const [selectedId, setSelectedId] = useState<string | null>(
    () => treeNodes.find((n) => n.status === "AVAILABLE")?.id ?? treeNodes[0]?.id ?? null,
  )

  useEffect(() => {
    if (!treeNodes.length) {
      setSelectedId(null)
      return
    }
    const current = treeNodes.find((n) => n.id === selectedId)
    if (current) return
    setSelectedId(
      treeNodes.find((n) => n.status === "AVAILABLE")?.id ??
        treeNodes.find((n) => n.status === "OWNED")?.id ??
        treeNodes[0]?.id ??
        null,
    )
  }, [selectedId, treeNodes])

  const scrollRef = useRef<HTMLDivElement>(null)
  const hubCol = layout.hub.col
  const hubRow = layout.hub.row
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const cell = el.scrollWidth / layout.cols
    el.scrollLeft = (hubCol + 0.5) * cell - el.clientWidth / 2
    el.scrollTop = (hubRow + 0.5) * cell - el.clientHeight / 2
  }, [hubCol, hubRow, layout.cols])

  const selected = treeNodes.find((n) => n.id === selectedId) ?? null
  const byId = useMemo(() => new Map(treeNodes.map((n) => [n.id, n])), [treeNodes])
  /** Circuits the selected node still needs (itself included) — highlighted on the board. */
  const pathSet = useMemo(() => new Set(selected?.path ?? []), [selected])
  const cheapest = useMemo(
    () =>
      treeNodes
        .filter((n) => n.status === "AVAILABLE")
        .reduce<TreeNode | null>((best, n) => (!best || n.cost < best.cost ? n : best), null),
    [treeNodes],
  )

  const scrollToCell = (cell: SkillCell) => {
    const el = scrollRef.current
    if (!el) return
    const size = el.scrollWidth / layout.cols
    el.scrollTo({
      left: (cell.col + 0.5) * size - el.clientWidth / 2,
      top: (cell.row + 0.5) * size - el.clientHeight / 2,
      behavior: "smooth",
    })
  }

  /** After unlocking `id`, move the selection to a child it just opened. */
  const selectNextAfter = (id: string, unlocked: string[]) => {
    const ownedNow = (rid: string) => unlocked.includes(rid) || byId.get(rid)?.status === "OWNED"
    const child = treeNodes.find(
      (n) => n.requires.includes(id) && n.status !== "OWNED" && !unlocked.includes(n.id) && n.requires.every(ownedNow),
    )
    if (child) setSelectedId(child.id)
  }

  const buySelected = (node: TreeNode) => {
    if (node.canBuy) {
      onBuy(node.id)
      selectNextAfter(node.id, [node.id])
    } else if (node.canBuyPath) {
      onBuyPath(node.id)
      selectNextAfter(node.id, node.path)
    }
  }

  const onNodeClick = (node: TreeNode) => {
    // Second tap on the selected, affordable circuit unlocks it — no trip to the button below.
    if (selectedId === node.id && node.canBuy) {
      buySelected(node)
      return
    }
    setSelectedId(node.id)
  }

  const edges = useMemo(() => {
    const lines: Array<{ d: string; branch: TreeNode["branch"]; lit: boolean; path: boolean }> = []
    for (const node of treeNodes) {
      const parents: SkillCell[] =
        node.requires.length > 0
          ? node.requires.map((id) => byId.get(id)).filter((n): n is TreeNode => Boolean(n))
          : [layout.hub]
      const onPath = pathSet.has(node.id)
      for (const parent of parents) {
        lines.push({ d: orthogonalPath(parent, node), branch: node.branch, lit: node.status === "OWNED", path: onPath })
      }
    }
    // Path edges last so they draw over the rest of the web.
    return lines.sort((a, b) => Number(a.path) - Number(b.path))
  }, [byId, layout.hub, pathSet, treeNodes])

  const head = (
    <div className="clicker-skill-tree-head">
      <div>
        <div className="clicker-skill-tree-title">CIRCUITS · 회로</div>
        <div className="clicker-skill-tree-sub">
          회로 {treeNodes.length}개 · 활성 {ownedCount} — 선행 회로를 해금하면 다음 노드가 열립니다
        </div>
      </div>
      <div className="clicker-skill-tree-head-side">
        <div className="clicker-skill-tree-sp" aria-live="polite">
          CORE <strong>{formatNumber(coreEnergy)}</strong>
        </div>
        {cheapest ? (
          <button
            type="button"
            className="clicker-skill-tree-next"
            onClick={() => {
              setSelectedId(cheapest.id)
              scrollToCell(cheapest)
            }}
          >
            해금 가능 ▸
          </button>
        ) : null}
      </div>
    </div>
  )

  if (!treeNodes.length) {
    return (
      <div className="clicker-skill-tree">
        {head}
        <p className="clicker-skill-tree-empty" role="status">
          회로가 아직 열리지 않았습니다. CORE를 모아 노드를 해금하세요.
        </p>
      </div>
    )
  }

  return (
    <div className="clicker-skill-tree">
      {head}

      <ul className="clicker-skill-legend" aria-label="노드 상태">
        <li className="is-available">해금 가능</li>
        <li className="is-poor">CORE 부족</li>
        <li className="is-owned">활성</li>
        <li className="is-locked">잠김 {lockedCount}</li>
      </ul>
      {ownedCount === treeNodes.length ? (
        <p className="clicker-skill-tree-empty" role="status">
          모든 회로를 활성화했습니다.
        </p>
      ) : null}

      <div className="clicker-skill-tree-stage">
        <div className="clicker-skill-tree-scroll" ref={scrollRef}>
          <div
            className="clicker-skill-tree-board"
            style={{
              width: `calc(var(--cell) * ${layout.cols})`,
              height: `calc(var(--cell) * ${layout.rows})`,
            }}
          >
            <svg
              className="clicker-skill-tree-lines"
              viewBox={`0 0 ${layout.cols} ${layout.rows}`}
              preserveAspectRatio="none"
              aria-hidden
            >
              {edges.map((edge, i) => (
                <path
                  key={`edge-${i}`}
                  d={edge.d}
                  fill="none"
                  className={edge.path ? "is-path" : undefined}
                  stroke={SKILL_BRANCH_COLOR[edge.branch]}
                  strokeWidth={edge.path ? 2.5 : edge.lit ? 2.5 : 1.5}
                  strokeOpacity={edge.path ? 1 : edge.lit ? 0.9 : 0.4}
                  strokeDasharray={edge.path && !edge.lit ? "4 3" : undefined}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>

            <div className="clicker-skill-node is-hub" style={cellStyle(layout.hub)} aria-hidden>
              <span className="clicker-skill-node-glyph">◆</span>
            </div>

            {treeNodes.map((node) => (
              <button
                key={node.id}
                type="button"
                className={`clicker-skill-node is-${node.status.toLowerCase()}${node.tier >= 5 ? " is-apex" : ""}${selectedId === node.id ? " is-selected" : ""}${pathSet.has(node.id) && selectedId !== node.id ? " is-path" : ""}`}
                style={
                  {
                    ...cellStyle(node),
                    "--branch-color": SKILL_BRANCH_COLOR[node.branch],
                    "--afford": node.status === "POOR" ? `${Math.floor(Math.min(1, coreEnergy / node.cost) * 100)}%` : undefined,
                  } as CSSProperties
                }
                aria-pressed={selectedId === node.id}
                aria-current={selectedId === node.id ? "true" : undefined}
                aria-label={`${node.name} · ${statusLabel(node.status)} · ${formatNumber(node.cost)} CORE`}
                onClick={() => onNodeClick(node)}
              >
                <span className="clicker-skill-node-glyph">{SKILL_BRANCH_GLYPH[node.branch]}</span>
              </button>
            ))}
          </div>
        </div>

        {selected && selected.status !== "OWNED" ? (
          <div className={`clicker-skill-quickbar is-${selected.status.toLowerCase()}`}>
            <span className="clicker-skill-quickbar-name">
              <span style={{ color: SKILL_BRANCH_COLOR[selected.branch] }}>{SKILL_BRANCH_GLYPH[selected.branch]}</span>{" "}
              {selected.name}
            </span>
            <button
              type="button"
              className="clicker-skill-quickbar-buy"
              disabled={!selected.canBuy && !(selected.status === "LOCKED" && selected.canBuyPath)}
              onClick={() => buySelected(selected)}
            >
              {selected.status === "LOCKED"
                ? `경로 ${selected.path.length} · ${formatNumber(selected.pathCost)}`
                : formatNumber(selected.cost)}{" "}
              CORE
            </button>
          </div>
        ) : null}
      </div>

      {selected ? (
        <aside className={`clicker-skill-detail is-${selected.status.toLowerCase()}`} aria-live="polite">
          <div className="clicker-skill-detail-top">
            <div className="clicker-skill-detail-meta">
              {SKILL_BRANCH_LABEL[selected.branch]} · T{selected.tier}
              {selected.tier >= 5 ? " · 정점" : ""}
            </div>
            <span className={`clicker-skill-detail-status is-${selected.status.toLowerCase()}`}>
              {statusLabel(selected.status)}
            </span>
          </div>
          <strong>{selected.name}</strong>
          <p className="clicker-skill-detail-effect">{selected.description}</p>
          {selected.status === "LOCKED" ? (
            <p className="clicker-skill-detail-requires">
              선행 회로 ·{" "}
              {selected.requires
                .filter((id) => byId.get(id)?.status !== "OWNED")
                .map((id) => byId.get(id)?.name ?? id)
                .join(", ")}
            </p>
          ) : null}
          <div className="clicker-skill-detail-stats">
            <span>
              비용 <strong>{formatNumber(selected.cost)} CORE</strong>
            </span>
            {selected.status === "LOCKED" ? (
              <span>
                경로 {selected.path.length}개 <strong>{formatNumber(selected.pathCost)} CORE</strong>
              </span>
            ) : null}
            {selected.status !== "OWNED" && coreEnergy < (selected.status === "LOCKED" ? selected.pathCost : selected.cost) ? (
              <span className="is-short">
                부족{" "}
                <strong>
                  {formatNumber(Math.max(0, (selected.status === "LOCKED" ? selected.pathCost : selected.cost) - coreEnergy))} CORE
                </strong>
              </span>
            ) : null}
          </div>
          {selected.status === "POOR" || (selected.status === "LOCKED" && !selected.canBuyPath) ? (
            <div
              className="clicker-skill-detail-progress"
              role="progressbar"
              aria-label="해금까지 모은 CORE"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.floor(
                Math.min(1, coreEnergy / (selected.status === "LOCKED" ? selected.pathCost : selected.cost)) * 100,
              )}
            >
              <span
                style={{
                  width: `${Math.min(1, coreEnergy / (selected.status === "LOCKED" ? selected.pathCost : selected.cost)) * 100}%`,
                }}
              />
            </div>
          ) : null}
          <button
            className="clicker-primary"
            type="button"
            disabled={!selected.canBuy && !(selected.status === "LOCKED" && selected.canBuyPath)}
            onClick={() => buySelected(selected)}
          >
            {selected.status === "OWNED"
              ? "활성화됨"
              : selected.status === "LOCKED"
                ? selected.canBuyPath
                  ? `경로 해금 · ${selected.path.length}개 · ${formatNumber(selected.pathCost)} CORE`
                  : `경로 해금 · ${formatNumber(selected.pathCost)} CORE 필요`
                : selected.status === "POOR"
                  ? `CORE 부족 · ${formatNumber(selected.cost)} 필요`
                  : `${formatNumber(selected.cost)} CORE로 해금`}
          </button>
          {selected.canBuy ? <p className="clicker-skill-detail-hint">노드를 한 번 더 누르면 바로 해금됩니다</p> : null}
        </aside>
      ) : (
        <p className="clicker-skill-tree-empty" role="status">
          회로 노드를 선택하면 비용과 효과가 여기에 표시됩니다.
        </p>
      )}
    </div>
  )
}
