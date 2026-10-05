"use client"

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react"
import {
  SKILL_BRANCH_COLOR,
  SKILL_BRANCH_LABEL,
  layoutSkillTree,
  connectorPath,
  type SkillCell,
} from "@/data/clicker/skill-tree-layout"
import { formatNumber, skillStatusLabel, type SkillNodeView } from "@/application/clicker-ui"
import { useClickerEscape } from "@/components/clicker/clicker-a11y"
import { CurrencyIcon } from "@/components/clicker/clicker-currency-icon"

type TreeNode = SkillNodeView & SkillCell

type Props = {
  nodes: SkillNodeView[]
  coreEnergy: number
  onBuy: (id: string) => void
  onClose: () => void
}

/** Board cell size in px. */
const CELL = 84
/** Moving the pointer this close to an edge pans the map that way. */
const EDGE = 56
const EDGE_SPEED = 9

/**
 * Full-screen circuit map. Only circuits whose prerequisites are all owned are drawn —
 * the rest stay hidden until their parent lights up. Drag (or push the pointer to an
 * edge, or scroll) to move around the map.
 */
export function ClickerSkillTree({ nodes, coreEnergy, onBuy, onClose }: Props) {
  useClickerEscape(true, onClose)
  // Positions come from the full tree so nothing jumps as circuits reveal.
  const layout = useMemo(() => layoutSkillTree(nodes), [nodes.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const treeNodes = useMemo<TreeNode[]>(
    () =>
      nodes
        // The final upgrade on the hub always shows, so the goal is visible from the start.
        .filter((node) => layout.cells[node.id] && (node.status !== "LOCKED" || node.id === layout.centerId))
        .map((node) => ({ ...node, ...layout.cells[node.id] })),
    [layout, nodes],
  )
  const byId = useMemo(() => new Map(treeNodes.map((n) => [n.id, n])), [treeNodes])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = (selectedId && byId.get(selectedId)) || null

  const viewRef = useRef<HTMLDivElement>(null)
  const [pan, setPan] = useState<{ x: number; y: number } | null>(null)
  const panRef = useRef({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null)
  const edge = useRef({ dx: 0, dy: 0 })

  const boardW = layout.cols * CELL
  const boardH = layout.rows * CELL

  const clampPan = (x: number, y: number) => {
    const el = viewRef.current
    const w = el?.clientWidth ?? 800
    const h = el?.clientHeight ?? 600
    const pad = 160
    return {
      x: Math.min(pad, Math.max(w - boardW - pad, x)),
      y: Math.min(pad, Math.max(h - boardH - pad, y)),
    }
  }
  const applyPan = (x: number, y: number) => {
    const next = clampPan(x, y)
    panRef.current = next
    setPan(next)
  }

  // Start centred on the hub.
  useEffect(() => {
    const el = viewRef.current
    if (!el) return
    applyPan(el.clientWidth / 2 - (layout.hub.col + 0.5) * CELL, el.clientHeight / 2 - (layout.hub.row + 0.5) * CELL)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Edge panning loop (desktop pointers only).
  useEffect(() => {
    let raf = 0
    const loop = () => {
      const { dx, dy } = edge.current
      if ((dx || dy) && !drag.current) applyPan(panRef.current.x - dx * EDGE_SPEED, panRef.current.y - dy * EDGE_SPEED)
      raf = window.requestAnimationFrame(loop)
    }
    raf = window.requestAnimationFrame(loop)
    return () => window.cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = { x: e.clientX, y: e.clientY, px: panRef.current.x, py: panRef.current.y, moved: false }
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = viewRef.current
    if (el && e.pointerType === "mouse") {
      const r = el.getBoundingClientRect()
      const x = e.clientX - r.left
      const y = e.clientY - r.top
      edge.current = {
        dx: x < EDGE ? -1 : x > r.width - EDGE ? 1 : 0,
        dy: y < EDGE ? -1 : y > r.height - EDGE ? 1 : 0,
      }
    }
    const d = drag.current
    if (!d) return
    const mx = e.clientX - d.x
    const my = e.clientY - d.y
    if (!d.moved && Math.hypot(mx, my) < 5) return
    if (!d.moved) {
      d.moved = true
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    applyPan(d.px + mx, d.py + my)
  }
  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.moved && e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    // Keep `moved` visible to the click that follows this pointerup.
    const d = drag.current
    window.setTimeout(() => {
      if (drag.current === d) drag.current = null
    }, 0)
  }

  const edges = useMemo(() => {
    const lines: Array<{ d: string; color: string; lit: boolean }> = []
    for (const node of treeNodes) {
      if (node.id === layout.centerId) continue
      const parents: SkillCell[] = node.requires.length
        ? node.requires.map((id) => byId.get(id)).filter((n): n is TreeNode => Boolean(n))
        : [layout.hub]
      for (const parent of parents) {
        lines.push({ d: connectorPath(parent, node), color: SKILL_BRANCH_COLOR[node.branch], lit: node.status === "OWNED" })
      }
    }
    return lines
  }, [byId, layout.centerId, layout.hub, treeNodes])

  const owned = treeNodes.filter((n) => n.status === "OWNED").length

  return (
    <div className="clicker-skillmap" role="dialog" aria-modal="true" aria-label="스킬 회로">
      <header className="clicker-skillmap-head">
        <strong>스킬 회로</strong>
        <span>
          활성 {owned}/{nodes.length} · CORE <b>{formatNumber(coreEnergy)}</b>
        </span>
        <button type="button" className="clicker-ghost clicker-skillmap-close" onClick={onClose}>
          닫기
        </button>
      </header>
      <div
        ref={viewRef}
        className="clicker-skillmap-view"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => (edge.current = { dx: 0, dy: 0 })}
        onWheel={(e) => applyPan(panRef.current.x - e.deltaX, panRef.current.y - e.deltaY)}
      >
        <div
          className="clicker-skillmap-board"
          style={{
            width: boardW,
            height: boardH,
            transform: `translate3d(${pan?.x ?? 0}px, ${pan?.y ?? 0}px, 0)`,
            visibility: pan ? "visible" : "hidden",
          }}
        >
          <svg className="clicker-skillmap-lines" viewBox={`0 0 ${layout.cols} ${layout.rows}`} preserveAspectRatio="none" aria-hidden>
            {edges.map((line, i) => (
              <path
                key={i}
                d={line.d}
                fill="none"
                stroke={line.color}
                strokeWidth={line.lit ? 3 : 1.5}
                strokeOpacity={line.lit ? 0.95 : 0.45}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
          <div className="clicker-skillmap-hub" style={{ left: (layout.hub.col + 0.5) * CELL, top: (layout.hub.row + 0.5) * CELL }} aria-hidden>
            <img src="/clicker/skill-node/hub_emblem.webp" alt="" draggable={false} />
          </div>
          {treeNodes.map((node) => (
            <button
              key={node.id}
              type="button"
              className={`clicker-skillmap-node is-${node.status.toLowerCase()}${selectedId === node.id ? " is-selected" : ""}${node.tier >= 5 ? " is-apex" : ""}${node.id === layout.centerId ? " is-final" : ""}`}
              style={{ left: (node.col + 0.5) * CELL, top: (node.row + 0.5) * CELL, "--branch-color": SKILL_BRANCH_COLOR[node.branch] } as CSSProperties}
              aria-label={`${node.name} · ${skillStatusLabel(node.status)} · ${formatNumber(node.cost)} CORE`}
              onClick={() => {
                if (drag.current?.moved) return
                setSelectedId(node.id)
              }}
            >
              {node.assetId ? <img src={node.assetId} alt="" draggable={false} /> : null}
            </button>
          ))}
        </div>
      </div>
      {selected ? (
        <aside className={`clicker-skillmap-detail is-${selected.status.toLowerCase()}`} aria-live="polite">
          {selected.assetId ? <img className="clicker-zoomable" src={selected.assetId} alt="" /> : null}
          <div>
            <small>
              {SKILL_BRANCH_LABEL[selected.branch]} · T{selected.tier}
            </small>
            <strong>{selected.name}</strong>
            <p>{selected.description}</p>
            {selected.status !== "OWNED" && selected.extraCosts.length ? (
              <p className="clicker-skillmap-costs">
                {selected.extraCosts.map((c) => (
                  <span key={c.regionId} className={c.enough ? "" : "is-short"} title={c.name}>
                    <CurrencyIcon regionId={c.regionId} /> {c.amountText}
                  </span>
                ))}
              </p>
            ) : null}
          </div>
          <button
            className="clicker-primary"
            type="button"
            disabled={!selected.canBuy}
            onClick={() => onBuy(selected.id)}
          >
            {selected.status === "OWNED"
              ? "활성"
              : selected.status === "LOCKED"
                ? "선행 회로 필요"
                : selected.status === "POOR" && selected.shortReason !== "CORE 부족"
                  ? selected.shortReason
                  : `${formatNumber(selected.cost)} CORE`}
          </button>
        </aside>
      ) : null}
    </div>
  )
}
