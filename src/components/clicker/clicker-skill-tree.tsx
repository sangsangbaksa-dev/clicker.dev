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

export function ClickerSkillTree({ nodes, coreEnergy, onBuy }: Props) {
  // Layout covers every node so positions stay put as new circuits appear.
  const layout = useMemo(() => layoutSkillTree(nodes), [nodes])
  const treeNodes = useMemo<TreeNode[]>(
    () =>
      nodes
        .filter((node) => node.visible && layout.cells[node.id])
        .map((node) => ({ ...node, ...layout.cells[node.id] })),
    [layout, nodes],
  )
  const hiddenCount = nodes.length - treeNodes.length

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

  const edges = useMemo(() => {
    const lines: Array<{ d: string; branch: TreeNode["branch"]; lit: boolean }> = []
    for (const node of treeNodes) {
      const parents: SkillCell[] =
        node.requires.length > 0
          ? node.requires.map((id) => byId.get(id)).filter((n): n is TreeNode => Boolean(n))
          : [layout.hub]
      for (const parent of parents) {
        lines.push({ d: orthogonalPath(parent, node), branch: node.branch, lit: node.status === "OWNED" })
      }
    }
    return lines
  }, [byId, layout.hub, treeNodes])

  const head = (
    <div className="clicker-skill-tree-head">
      <div>
        <div className="clicker-skill-tree-title">CIRCUITS · 회로</div>
        <div className="clicker-skill-tree-sub">
          기억 회로 — 노드를 CORE로 해금하면 이어진 회로가 드러납니다
        </div>
      </div>
      <div className="clicker-skill-tree-sp" aria-live="polite">
        CORE <strong>{formatNumber(coreEnergy)}</strong>
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
        {hiddenCount > 0 ? <li className="is-hidden">숨은 회로 {hiddenCount}</li> : null}
      </ul>
      {hiddenCount === 0 && treeNodes.every((n) => n.status === "OWNED") ? (
        <p className="clicker-skill-tree-empty" role="status">
          모든 회로를 활성화했습니다.
        </p>
      ) : null}

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
                stroke={SKILL_BRANCH_COLOR[edge.branch]}
                strokeWidth={edge.lit ? 2.5 : 1.5}
                strokeOpacity={edge.lit ? 0.9 : 0.4}
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
              className={`clicker-skill-node is-${node.status.toLowerCase()}${node.tier >= 5 ? " is-apex" : ""}${selectedId === node.id ? " is-selected" : ""}`}
              style={{ ...cellStyle(node), "--branch-color": SKILL_BRANCH_COLOR[node.branch] } as CSSProperties}
              aria-pressed={selectedId === node.id}
              aria-current={selectedId === node.id ? "true" : undefined}
              aria-label={`${node.name} · ${statusLabel(node.status)} · ${formatNumber(node.cost)} CORE`}
              onClick={() => setSelectedId(node.id)}
            >
              <span className="clicker-skill-node-glyph">{SKILL_BRANCH_GLYPH[node.branch]}</span>
            </button>
          ))}
        </div>
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
          <div className="clicker-skill-detail-stats">
            <span>
              비용 <strong>{formatNumber(selected.cost)} CORE</strong>
            </span>
            <span>
              보유 <strong>{formatNumber(coreEnergy)} CORE</strong>
            </span>
            {selected.status === "POOR" ? (
              <span className="is-short">
                부족 <strong>{formatNumber(Math.max(0, selected.cost - coreEnergy))} CORE</strong>
              </span>
            ) : null}
          </div>
          <button
            className="clicker-primary"
            type="button"
            disabled={!selected.canBuy}
            onClick={() => {
              onBuy(selected.id)
              const child = nodes.find(
                (n) =>
                  n.requires.includes(selected.id) &&
                  n.status !== "OWNED" &&
                  n.requires.every((id) => id === selected.id || byId.get(id)?.status === "OWNED"),
              )
              if (child) setSelectedId(child.id)
            }}
          >
            {selected.status === "OWNED"
              ? "활성화됨"
              : selected.status === "POOR"
                ? `CORE 부족 · ${formatNumber(selected.cost)} 필요`
                : `${formatNumber(selected.cost)} CORE로 해금`}
          </button>
        </aside>
      ) : (
        <p className="clicker-skill-tree-empty" role="status">
          회로 노드를 선택하면 비용과 효과가 여기에 표시됩니다.
        </p>
      )}
    </div>
  )
}
