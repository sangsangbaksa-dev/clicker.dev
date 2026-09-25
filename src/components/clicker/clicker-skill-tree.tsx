"use client"

import { useEffect, useMemo, useState, type CSSProperties } from "react"
import {
  SKILL_BRANCH_COLOR,
  SKILL_BRANCH_GLYPH,
  SKILL_BRANCH_LABEL,
  SKILL_TREE_HUB,
  SKILL_TREE_LAYOUT,
} from "@/data/clicker/skill-tree-layout"
import type { SkillNodeView } from "@/domain/services/clicker-view"
import { formatNumber } from "@/domain/services/clicker-format"

type TreeNode = SkillNodeView & { x: number; y: number }

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

export function ClickerSkillTree({ nodes, coreEnergy, onBuy }: Props) {
  const treeNodes = useMemo<TreeNode[]>(
    () =>
      nodes.map((node) => ({
        ...node,
        x: SKILL_TREE_LAYOUT[node.id]?.x ?? 50,
        y: SKILL_TREE_LAYOUT[node.id]?.y ?? 50,
      })),
    [nodes],
  )

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

  const selected = treeNodes.find((n) => n.id === selectedId) ?? null
  const byId = useMemo(() => new Map(treeNodes.map((n) => [n.id, n])), [treeNodes])

  const edges = useMemo(() => {
    const lines: Array<{ x1: number; y1: number; x2: number; y2: number; branch: TreeNode["branch"]; lit: boolean }> = []
    for (const node of treeNodes) {
      const parentPoints =
        node.requires.length > 0
          ? node.requires.map((id) => byId.get(id)).filter((n): n is TreeNode => Boolean(n))
          : [{ x: SKILL_TREE_HUB.x, y: SKILL_TREE_HUB.y, status: "OWNED" as TreeNode["status"] }]
      for (const parent of parentPoints) {
        const parentOwned = parent.status === "OWNED"
        const lit = node.status === "OWNED" || (parentOwned && node.status !== "LOCKED")
        lines.push({
          x1: parent.x,
          y1: parent.y,
          x2: node.x,
          y2: node.y,
          branch: node.branch,
          lit,
        })
      }
    }
    return lines
  }, [byId, treeNodes])

  if (!treeNodes.length) {
    return (
      <div className="clicker-skill-tree">
        <div className="clicker-skill-tree-head">
          <div>
            <div className="clicker-skill-tree-title">CIRCUITS · 회로</div>
            <div className="clicker-skill-tree-sub">표시할 회로 노드가 없습니다.</div>
          </div>
          <div className="clicker-skill-tree-sp" aria-live="polite">
            CORE <strong>{formatNumber(coreEnergy)}</strong>
          </div>
        </div>
        <p className="clicker-skill-tree-empty" role="status">
          회로가 아직 열리지 않았습니다. CORE를 모아 노드를 해금하세요.
        </p>
      </div>
    )
  }

  return (
    <div className="clicker-skill-tree">
      <div className="clicker-skill-tree-head">
        <div>
          <div className="clicker-skill-tree-title">CIRCUITS · 회로</div>
          <div className="clicker-skill-tree-sub">
            기억 회로 — 노드를 CORE로 해금합니다
          </div>
        </div>
        <div className="clicker-skill-tree-sp" aria-live="polite">
          CORE <strong>{formatNumber(coreEnergy)}</strong>
        </div>
      </div>

      <ul className="clicker-skill-legend" aria-label="노드 상태">
        <li className="is-available">해금 가능</li>
        <li className="is-poor">CORE 부족</li>
        <li className="is-locked">잠김</li>
        <li className="is-owned">활성</li>
      </ul>
      {treeNodes.length > 0 && treeNodes.every((n) => n.status === "OWNED") ? (
        <p className="clicker-skill-tree-empty" role="status">
          표시된 회로를 모두 활성화했습니다.
        </p>
      ) : null}

      <div className="clicker-skill-tree-scroll">
      <div className="clicker-skill-tree-board">
        <svg className="clicker-skill-tree-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {edges.map((edge, i) => (
            <line
              key={`edge-${i}`}
              x1={edge.x1}
              y1={edge.y1}
              x2={edge.x2}
              y2={edge.y2}
              stroke={SKILL_BRANCH_COLOR[edge.branch]}
              strokeWidth={edge.lit ? 0.55 : 0.35}
              strokeOpacity={edge.lit ? 0.85 : 0.22}
            />
          ))}
        </svg>

        <div
          className="clicker-skill-node is-hub"
          style={{ left: `${SKILL_TREE_HUB.x}%`, top: `${SKILL_TREE_HUB.y}%` }}
          aria-hidden
        >
          <span className="clicker-skill-node-glyph">◆</span>
        </div>

        {treeNodes.map((node) => (
          <button
            key={node.id}
            type="button"
            className={`clicker-skill-node is-${node.status.toLowerCase()}${node.tier >= 5 ? " is-apex" : ""}${selectedId === node.id ? " is-selected" : ""}`}
            style={
              {
                left: `${node.x}%`,
                top: `${node.y}%`,
                "--branch-color": SKILL_BRANCH_COLOR[node.branch],
              } as CSSProperties
            }
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
          {selected.status === "LOCKED" && selected.requires.length > 0 ? (
            <p className="clicker-skill-detail-req">
              선행:{" "}
              {selected.requires
                .map((id) => byId.get(id)?.name ?? id)
                .filter(Boolean)
                .join(" → ")}
            </p>
          ) : null}
          <button
            className="clicker-primary"
            type="button"
            disabled={!selected.canBuy}
            onClick={() => {
              onBuy(selected.id)
              const child = treeNodes.find((n) => n.requires.includes(selected.id) && n.status !== "OWNED")
              if (child) setSelectedId(child.id)
            }}
          >
            {selected.status === "OWNED"
              ? "활성화됨"
              : selected.status === "LOCKED"
                ? "선행 스킬 필요"
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
