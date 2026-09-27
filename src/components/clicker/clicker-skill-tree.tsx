"use client"

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react"
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
  /** Leave the fullscreen tree. */
  onClose: () => void
}

/** Screen box of the node a tip is anchored to. */
type Anchor = { left: number; top: number; right: number; bottom: number }

const TIP_WIDTH = 288
const TIP_GAP = 12
const TIP_HIDE_MS = 160

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

export function ClickerSkillTree({ nodes, coreEnergy, onBuy, onBuyPath, onClose }: Props) {
  // The whole tree is always on the board; locked circuits show dimmed with their prerequisites.
  const layout = useMemo(() => layoutSkillTree(nodes), [nodes])
  const treeNodes = useMemo<TreeNode[]>(
    () => nodes.filter((node) => layout.cells[node.id]).map((node) => ({ ...node, ...layout.cells[node.id] })),
    [layout, nodes],
  )
  const ownedCount = treeNodes.filter((n) => n.status === "OWNED").length
  const lockedCount = treeNodes.filter((n) => n.status === "LOCKED").length

  /**
   * The hover card: follows the mouse over nodes, and stays put (pinned) after a click or tap
   * so touch screens and keyboard users get the same card.
   */
  const [tip, setTip] = useState<{ id: string; anchor: Anchor; pinned: boolean } | null>(null)
  const hideTimer = useRef(0)
  const cancelHide = () => window.clearTimeout(hideTimer.current)
  const scheduleHide = () => {
    cancelHide()
    hideTimer.current = window.setTimeout(() => setTip((t) => (t?.pinned ? t : null)), TIP_HIDE_MS)
  }
  useEffect(() => () => window.clearTimeout(hideTimer.current), [])

  const anchorOf = (el: Element): Anchor => {
    const r = el.getBoundingClientRect()
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
  }
  const showTip = (id: string, el: Element, pinned: boolean) => {
    cancelHide()
    setTip((t) => ({ id, anchor: anchorOf(el), pinned: pinned || (t?.id === id && t.pinned) }))
  }

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

  const byId = useMemo(() => new Map(treeNodes.map((n) => [n.id, n])), [treeNodes])
  const active = tip ? (byId.get(tip.id) ?? null) : null
  /** Circuits the shown node still needs (itself included) — highlighted on the board. */
  const pathSet = useMemo(() => new Set(active?.status === "OWNED" ? [] : (active?.path ?? [])), [active])
  const cheapest = useMemo(
    () =>
      treeNodes
        .filter((n) => n.status === "AVAILABLE")
        .reduce<TreeNode | null>((best, n) => (!best || n.cost < best.cost ? n : best), null),
    [treeNodes],
  )

  const nodeEl = (id: string) => scrollRef.current?.querySelector(`[data-node-id="${id}"]`) ?? null

  /** Keep the card glued to its node while the board scrolls. */
  const onBoardScroll = () => {
    if (!tip) return
    const el = nodeEl(tip.id)
    if (el) setTip({ ...tip, anchor: anchorOf(el) })
  }

  const jumpTo = (node: TreeNode) => {
    const el = scrollRef.current
    if (!el) return
    const size = el.scrollWidth / layout.cols
    el.scrollTo({
      left: (node.col + 0.5) * size - el.clientWidth / 2,
      top: (node.row + 0.5) * size - el.clientHeight / 2,
    })
    window.requestAnimationFrame(() => {
      const target = nodeEl(node.id)
      if (target) showTip(node.id, target, true)
    })
  }

  const buy = (node: TreeNode) => {
    if (node.canBuy) onBuy(node.id)
    else if (node.status === "LOCKED" && node.canBuyPath) onBuyPath(node.id)
  }

  const onNodeClick = (node: TreeNode, el: HTMLElement) => {
    // Clicking the node whose card is already pinned unlocks it — the card's button is optional.
    if (tip?.id === node.id && tip.pinned && node.canBuy) {
      buy(node)
      return
    }
    showTip(node.id, el, true)
  }

  const onNodeEnter = (e: PointerEvent<HTMLButtonElement>, node: TreeNode) => {
    if (e.pointerType !== "mouse") return
    // A pinned card stays until another node is hovered or clicked.
    showTip(node.id, e.currentTarget, false)
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
          회로 {treeNodes.length}개 · 활성 {ownedCount} — 노드에 마우스를 올리면 효과와 해금 버튼이 보입니다
        </div>
      </div>
      <div className="clicker-skill-tree-head-side">
        <div className="clicker-skill-tree-sp" aria-live="polite">
          CORE <strong>{formatNumber(coreEnergy)}</strong>
        </div>
        {cheapest ? (
          <button type="button" className="clicker-skill-tree-next" onClick={() => jumpTo(cheapest)}>
            해금 가능 ▸
          </button>
        ) : null}
        <button type="button" className="clicker-skill-tree-close" aria-label="스킬 트리 닫기 · Esc" onClick={onClose}>
          닫기 · Esc
        </button>
      </div>
    </div>
  )

  if (!treeNodes.length) {
    return (
      <div className="clicker-skill-tree is-fullscreen" role="dialog" aria-modal="true" aria-label="스킬 회로">
        {head}
        <p className="clicker-skill-tree-empty" role="status">
          회로가 아직 열리지 않았습니다. CORE를 모아 노드를 해금하세요.
        </p>
      </div>
    )
  }

  const tipStyle = (anchor: Anchor): CSSProperties => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const fitsRight = anchor.right + TIP_GAP + TIP_WIDTH <= vw - 8
    const left = fitsRight ? anchor.right + TIP_GAP : anchor.left - TIP_GAP - TIP_WIDTH
    return {
      width: TIP_WIDTH,
      left: Math.max(8, Math.min(vw - TIP_WIDTH - 8, left)),
      // Room for the tallest card (locked circuit with progress) below the anchor's top.
      top: Math.max(8, Math.min(vh - 300, anchor.top - 24)),
    }
  }

  return (
    <div className="clicker-skill-tree is-fullscreen" role="dialog" aria-modal="true" aria-label="스킬 회로">
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
        <div className="clicker-skill-tree-scroll" ref={scrollRef} onScroll={onBoardScroll}>
          <div
            className="clicker-skill-tree-board"
            style={{
              width: `calc(var(--cell) * ${layout.cols})`,
              height: `calc(var(--cell) * ${layout.rows})`,
            }}
            onClick={(e) => {
              // A click on empty board drops the pinned card.
              if (e.target === e.currentTarget) setTip(null)
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
                data-node-id={node.id}
                className={`clicker-skill-node is-${node.status.toLowerCase()}${node.tier >= 5 ? " is-apex" : ""}${tip?.id === node.id ? " is-selected" : ""}${pathSet.has(node.id) && tip?.id !== node.id ? " is-path" : ""}`}
                style={
                  {
                    ...cellStyle(node),
                    "--branch-color": SKILL_BRANCH_COLOR[node.branch],
                    "--afford": node.status === "POOR" ? `${Math.floor(Math.min(1, coreEnergy / node.cost) * 100)}%` : undefined,
                  } as CSSProperties
                }
                aria-pressed={tip?.id === node.id}
                aria-label={`${node.name} · ${statusLabel(node.status)} · ${formatNumber(node.cost)} CORE`}
                onPointerEnter={(e) => onNodeEnter(e, node)}
                onPointerLeave={scheduleHide}
                onFocus={(e) => showTip(node.id, e.currentTarget, false)}
                onClick={(e) => onNodeClick(node, e.currentTarget)}
              >
                <span className="clicker-skill-node-glyph">{SKILL_BRANCH_GLYPH[node.branch]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {active && tip ? (
        <aside
          className={`clicker-skill-detail clicker-skill-tip is-${active.status.toLowerCase()}`}
          style={tipStyle(tip.anchor)}
          aria-live="polite"
          onPointerEnter={cancelHide}
          onPointerLeave={scheduleHide}
        >
          <div className="clicker-skill-detail-top">
            <div className="clicker-skill-detail-meta">
              {SKILL_BRANCH_LABEL[active.branch]} · T{active.tier}
              {active.tier >= 5 ? " · 정점" : ""}
            </div>
            <span className={`clicker-skill-detail-status is-${active.status.toLowerCase()}`}>
              {statusLabel(active.status)}
            </span>
            {tip.pinned ? (
              <button type="button" className="clicker-skill-tip-close" aria-label="설명 닫기" onClick={() => setTip(null)}>
                ×
              </button>
            ) : null}
          </div>
          <strong>{active.name}</strong>
          <p className="clicker-skill-detail-effect">{active.description}</p>
          {active.status === "LOCKED" ? (
            <p className="clicker-skill-detail-requires">
              선행 회로 ·{" "}
              {active.requires
                .filter((id) => byId.get(id)?.status !== "OWNED")
                .map((id) => byId.get(id)?.name ?? id)
                .join(", ")}
            </p>
          ) : null}
          <div className="clicker-skill-detail-stats">
            <span>
              비용 <strong>{formatNumber(active.cost)} CORE</strong>
            </span>
            {active.status === "LOCKED" ? (
              <span>
                경로 {active.path.length}개 <strong>{formatNumber(active.pathCost)} CORE</strong>
              </span>
            ) : null}
            {active.status !== "OWNED" && coreEnergy < (active.status === "LOCKED" ? active.pathCost : active.cost) ? (
              <span className="is-short">
                부족{" "}
                <strong>
                  {formatNumber(Math.max(0, (active.status === "LOCKED" ? active.pathCost : active.cost) - coreEnergy))} CORE
                </strong>
              </span>
            ) : null}
          </div>
          {active.status === "POOR" || (active.status === "LOCKED" && !active.canBuyPath) ? (
            <div
              className="clicker-skill-detail-progress"
              role="progressbar"
              aria-label="해금까지 모은 CORE"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.floor(
                Math.min(1, coreEnergy / (active.status === "LOCKED" ? active.pathCost : active.cost)) * 100,
              )}
            >
              <span
                style={{
                  width: `${Math.min(1, coreEnergy / (active.status === "LOCKED" ? active.pathCost : active.cost)) * 100}%`,
                }}
              />
            </div>
          ) : null}
          <button
            className="clicker-primary"
            type="button"
            disabled={!active.canBuy && !(active.status === "LOCKED" && active.canBuyPath)}
            onClick={() => buy(active)}
          >
            {active.status === "OWNED"
              ? "활성화됨"
              : active.status === "LOCKED"
                ? active.canBuyPath
                  ? `경로 해금 · ${active.path.length}개 · ${formatNumber(active.pathCost)} CORE`
                  : `경로 해금 · ${formatNumber(active.pathCost)} CORE 필요`
                : active.status === "POOR"
                  ? `CORE 부족 · ${formatNumber(active.cost)} 필요`
                  : `${formatNumber(active.cost)} CORE로 해금`}
          </button>
          {active.canBuy && tip.pinned ? <p className="clicker-skill-detail-hint">노드를 한 번 더 누르면 바로 해금됩니다</p> : null}
        </aside>
      ) : null}
    </div>
  )
}
