"use client"

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"
import {
  SKILL_BRANCH_COLOR,
  SKILL_BRANCH_GLYPH,
  SKILL_BRANCH_LABEL,
  layoutSkillTree,
  orthogonalPath,
  type SkillCell,
} from "@/data/clicker/skill-tree-layout"
import type { SkillBranch } from "@/domain/entities/clicker"
import type { SkillNodeView } from "@/domain/services/clicker-view"
import { formatNumber } from "@/domain/services/clicker-format"
import "./clicker-skill-tree.css"

type TreeNode = SkillNodeView & SkillCell

type Props = {
  nodes: SkillNodeView[]
  coreEnergy: number
  onBuy: (id: string) => void
}

const BRANCHES: SkillBranch[] = ["FOCUS", "AUTOMATION", "RESONANCE", "TRANSCENDENCE"]
const ZOOM_MIN = 0.6
const ZOOM_MAX = 1.6
const ZOOM_STEP = 0.2
/** Names and effects print under the nodes from this zoom up. */
const ZOOM_LABELS = 1.2
/** Pointer travel (px) before a press on the board turns into a pan. */
const PAN_SLOP = 6

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

function clampZoom(z: number) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100))
}

/**
 * Circuit board in the style of idle-game passive trees (Antimatter Dimensions studies,
 * PoE-like passives): drag to pan, zoom buttons, a docked detail card that never scrolls
 * off-screen, branch filters, and "unlock the whole path" for a locked target.
 */
export function ClickerSkillTree({ nodes, coreEnergy, onBuy }: Props) {
  // The whole tree is always on the board; locked circuits show dimmed with their prerequisites.
  const layout = useMemo(() => layoutSkillTree(nodes), [nodes])
  const treeNodes = useMemo<TreeNode[]>(
    () => nodes.filter((node) => layout.cells[node.id]).map((node) => ({ ...node, ...layout.cells[node.id] })),
    [layout, nodes],
  )
  const byId = useMemo(() => new Map(treeNodes.map((n) => [n.id, n])), [treeNodes])
  const ownedCount = treeNodes.filter((n) => n.status === "OWNED").length
  const buyable = useMemo(
    () => treeNodes.filter((n) => n.status === "AVAILABLE").sort((a, b) => a.cost - b.cost),
    [treeNodes],
  )

  const [selectedId, setSelectedId] = useState<string | null>(
    () => treeNodes.find((n) => n.status === "AVAILABLE")?.id ?? treeNodes[0]?.id ?? null,
  )
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [branch, setBranch] = useState<SkillBranch | "ALL">("ALL")
  const [zoom, setZoom] = useState(1)
  const [summaryOpen, setSummaryOpen] = useState(false)

  useEffect(() => {
    if (!treeNodes.length) {
      setSelectedId(null)
      return
    }
    if (treeNodes.some((n) => n.id === selectedId)) return
    setSelectedId(
      treeNodes.find((n) => n.status === "AVAILABLE")?.id ??
        treeNodes.find((n) => n.status === "OWNED")?.id ??
        treeNodes[0]?.id ??
        null,
    )
  }, [selectedId, treeNodes])

  const children = useMemo(() => {
    const map = new Map<string, TreeNode[]>()
    for (const node of treeNodes) {
      for (const req of node.requires) map.set(req, [...(map.get(req) ?? []), node])
    }
    return map
  }, [treeNodes])

  /** Unowned prerequisites of `id` (and `id` itself), parents first — the path to unlock it. */
  const pathTo = useCallback(
    (id: string): TreeNode[] => {
      const out: TreeNode[] = []
      const seen = new Set<string>()
      const visit = (nid: string) => {
        if (seen.has(nid)) return
        seen.add(nid)
        const node = byId.get(nid)
        if (!node || node.status === "OWNED") return
        for (const req of node.requires) visit(req)
        out.push(node)
      }
      visit(id)
      return out
    },
    [byId],
  )

  const selected = selectedId ? (byId.get(selectedId) ?? null) : null
  const path = useMemo(() => (selected ? pathTo(selected.id) : []), [pathTo, selected])
  const pathIds = useMemo(() => new Set(path.map((n) => n.id)), [path])
  const pathCost = path.reduce((sum, n) => sum + n.cost, 0)

  // ---- Viewport: zoom + drag-to-pan -------------------------------------------------------
  const scrollRef = useRef<HTMLDivElement>(null)
  const baseCell = useRef(56)

  const centerOn = useCallback(
    (cell: SkillCell, smooth = true, z = zoom) => {
      const el = scrollRef.current
      if (!el) return
      const size = baseCell.current * z
      el.scrollTo({
        left: (cell.col + 0.5) * size - el.clientWidth / 2,
        top: (cell.row + 0.5) * size - el.clientHeight / 2,
        behavior: smooth ? "smooth" : "auto",
      })
    },
    [zoom],
  )

  // First paint: start on the selected circuit (or the hub) instead of the top-left corner.
  const didInitialCenter = useRef(false)
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || didInitialCenter.current || !treeNodes.length) return
    didInitialCenter.current = true
    baseCell.current = parseFloat(getComputedStyle(el).getPropertyValue("--cell-base")) || 56
    centerOn(selected ?? layout.hub, false)
  }, [centerOn, layout.hub, selected, treeNodes.length])

  /** Zoom keeping the viewport's centre (or a pointer position) fixed. */
  const zoomTo = useCallback(
    (next: number, anchor?: { x: number; y: number }) => {
      const el = scrollRef.current
      const z = clampZoom(next)
      if (!el || z === zoom) return
      const ax = anchor?.x ?? el.clientWidth / 2
      const ay = anchor?.y ?? el.clientHeight / 2
      const k = z / zoom
      const left = (el.scrollLeft + ax) * k - ax
      const top = (el.scrollTop + ay) * k - ay
      setZoom(z)
      window.requestAnimationFrame(() => el.scrollTo({ left, top }))
    },
    [zoom],
  )

  const fitAll = () => {
    const el = scrollRef.current
    if (!el) return
    const z = clampZoom(
      Math.min(el.clientWidth / (layout.cols * baseCell.current), el.clientHeight / (layout.rows * baseCell.current)),
    )
    setZoom(z)
    window.requestAnimationFrame(() => centerOn({ col: (layout.cols - 1) / 2, row: (layout.rows - 1) / 2 }, false, z))
  }

  // Ctrl/⌘ + wheel (and trackpad pinch) zooms; a plain wheel still scrolls.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      zoomTo(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), { x: e.clientX - rect.left, y: e.clientY - rect.top })
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [zoom, zoomTo])

  const drag = useRef({ id: -1, x: 0, y: 0, left: 0, top: 0, panning: false })
  const [panning, setPanning] = useState(false)
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // Touch already pans natively; mouse/pen get grab-to-pan.
    if (e.pointerType === "touch" || e.button !== 0) return
    const el = scrollRef.current
    if (!el) return
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop, panning: false }
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    const el = scrollRef.current
    if (d.id !== e.pointerId || !el) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.panning) {
      if (Math.hypot(dx, dy) < PAN_SLOP) return
      d.panning = true
      setPanning(true)
      setHoverId(null)
      el.setPointerCapture(e.pointerId)
    }
    el.scrollLeft = d.left - dx
    el.scrollTop = d.top - dy
  }
  const endPan = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current.id !== e.pointerId) return
    const wasPanning = drag.current.panning
    drag.current.id = -1
    if (!wasPanning) return
    setPanning(false)
    // Swallow the click that follows a drag so releasing over a node doesn't select it.
    const swallow = (ev: MouseEvent) => {
      ev.stopPropagation()
      ev.preventDefault()
    }
    window.addEventListener("click", swallow, { capture: true, once: true })
    window.setTimeout(() => window.removeEventListener("click", swallow, true), 0)
  }

  const select = (id: string, focus = false) => {
    setSelectedId(id)
    const node = byId.get(id)
    if (focus && node) centerOn(node)
  }

  /** Arrow keys walk to the nearest circuit in that direction (keyboard play). */
  const onBoardKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const dirs: Record<string, [number, number]> = {
      ArrowRight: [1, 0],
      ArrowLeft: [-1, 0],
      ArrowDown: [0, 1],
      ArrowUp: [0, -1],
    }
    const dir = dirs[e.key]
    if (!dir) return
    e.preventDefault()
    const from: SkillCell = selected ?? layout.hub
    let best: TreeNode | null = null
    let bestScore = Infinity
    for (const node of treeNodes) {
      const dx = node.col - from.col
      const dy = node.row - from.row
      const along = dx * dir[0] + dy * dir[1]
      if (along <= 0) continue
      const score = along + (Math.abs(dx * dir[1]) + Math.abs(dy * dir[0])) * 2.5
      if (score < bestScore) {
        bestScore = score
        best = node
      }
    }
    if (!best) return
    const id = best.id
    setSelectedId(id)
    centerOn(best)
    window.requestAnimationFrame(() =>
      scrollRef.current?.querySelector<HTMLButtonElement>(`[data-node-id="${id}"]`)?.focus({ preventScroll: true }),
    )
  }

  const nextBuyable = () => {
    if (!buyable.length) return
    const i = buyable.findIndex((n) => n.id === selectedId)
    select(buyable[(i + 1) % buyable.length].id, true)
  }

  const pickBranch = (b: SkillBranch | "ALL") => {
    setBranch(b)
    if (b === "ALL") return
    const inBranch = treeNodes.filter((n) => n.branch === b)
    const target =
      inBranch.find((n) => n.status === "AVAILABLE") ??
      inBranch.find((n) => n.status === "POOR") ??
      inBranch.find((n) => n.status !== "OWNED") ??
      inBranch[0]
    if (target) select(target.id, true)
  }

  const buy = (target: TreeNode) => {
    onBuy(target.id)
    const next = (children.get(target.id) ?? []).find(
      (n) => n.status !== "OWNED" && n.requires.every((id) => id === target.id || byId.get(id)?.status === "OWNED"),
    )
    if (next) setSelectedId(next.id)
  }

  const buyPath = () => {
    if (!selected || pathCost > coreEnergy) return
    // Parents first, so every purchase meets its prerequisites.
    for (const node of path) onBuy(node.id)
  }

  const edges = useMemo(() => {
    const lines: Array<{ key: string; d: string; branch: SkillBranch; lit: boolean; onPath: boolean }> = []
    for (const node of treeNodes) {
      const parents: Array<SkillCell & { id?: string; status?: string }> =
        node.requires.length > 0
          ? node.requires.map((id) => byId.get(id)).filter((n): n is TreeNode => Boolean(n))
          : [layout.hub]
      for (const parent of parents) {
        lines.push({
          key: `${parent.id ?? "hub"}-${node.id}`,
          d: orthogonalPath(parent, node),
          branch: node.branch,
          lit: node.status === "OWNED",
          onPath: pathIds.has(node.id) && (!parent.id || pathIds.has(parent.id) || parent.status === "OWNED"),
        })
      }
    }
    // Path edges last so they draw over the rest.
    return lines.sort((a, b) => Number(a.onPath) - Number(b.onPath))
  }, [byId, layout.hub, pathIds, treeNodes])

  const branchStats = useMemo(
    () =>
      BRANCHES.map((b) => {
        const list = treeNodes.filter((n) => n.branch === b)
        return {
          branch: b,
          owned: list.filter((n) => n.status === "OWNED").length,
          total: list.length,
          ready: list.filter((n) => n.status === "AVAILABLE").length,
        }
      }).filter((s) => s.total > 0),
    [treeNodes],
  )

  const hovered = hoverId ? byId.get(hoverId) : null
  const showLabels = zoom >= ZOOM_LABELS

  if (!treeNodes.length) {
    return (
      <div className="clicker-skill-tree">
        <p className="clicker-skill-tree-empty" role="status">
          회로가 아직 열리지 않았습니다. CORE를 모아 노드를 해금하세요.
        </p>
      </div>
    )
  }

  const shortBy = selected ? Math.max(0, selected.cost - coreEnergy) : 0
  const fundRatio = selected && selected.cost > 0 ? Math.min(1, coreEnergy / selected.cost) : 1
  const nextOnes = selected ? (children.get(selected.id) ?? []) : []

  return (
    <div className={`clicker-skill-tree${showLabels ? " is-labeled" : ""}`}>
      <div className="clicker-skill-tree-head">
        <div className="clicker-skill-tree-progress">
          <span className="clicker-skill-tree-title">회로 {ownedCount}/{treeNodes.length}</span>
          <span className="clicker-skill-tree-meter" aria-hidden>
            <i style={{ width: `${(ownedCount / treeNodes.length) * 100}%` }} />
          </span>
        </div>
        <button
          type="button"
          className={`clicker-skill-next${buyable.length ? " is-ready" : ""}`}
          disabled={!buyable.length}
          onClick={nextBuyable}
          aria-label={buyable.length ? `해금 가능한 회로 ${buyable.length}개 — 다음으로 이동` : "해금 가능한 회로 없음"}
        >
          해금 가능 <strong>{buyable.length}</strong>
          {buyable.length ? <span aria-hidden> →</span> : null}
        </button>
        <div className="clicker-skill-tree-sp" aria-live="polite">
          CORE <strong>{formatNumber(coreEnergy)}</strong>
        </div>
      </div>

      <div className="clicker-skill-toolbar">
        <div className="clicker-skill-branches" role="group" aria-label="분기 필터">
          <button type="button" aria-pressed={branch === "ALL"} onClick={() => pickBranch("ALL")}>
            전체
          </button>
          {branchStats.map((s) => (
            <button
              key={s.branch}
              type="button"
              aria-pressed={branch === s.branch}
              style={{ "--branch-color": SKILL_BRANCH_COLOR[s.branch] } as CSSProperties}
              onClick={() => pickBranch(s.branch)}
              aria-label={`${SKILL_BRANCH_LABEL[s.branch]} · 활성 ${s.owned}/${s.total}${s.ready ? ` · 해금 가능 ${s.ready}` : ""}`}
            >
              <span className="clicker-skill-branch-glyph" aria-hidden>
                {SKILL_BRANCH_GLYPH[s.branch]}
              </span>
              {SKILL_BRANCH_LABEL[s.branch]}
              <em>
                {s.owned}/{s.total}
              </em>
              {s.ready ? <b className="clicker-skill-branch-dot" aria-hidden /> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="clicker-skill-body">
        <div className="clicker-skill-viewport">
          <div
            className={`clicker-skill-tree-scroll${panning ? " is-panning" : ""}`}
            ref={scrollRef}
            style={{ "--zoom": zoom } as CSSProperties}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endPan}
            onPointerCancel={endPan}
            onKeyDown={onBoardKeyDown}
          >
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
                {edges.map((edge) => (
                  <path
                    key={edge.key}
                    d={edge.d}
                    fill="none"
                    className={edge.onPath ? "is-path" : undefined}
                    stroke={SKILL_BRANCH_COLOR[edge.branch]}
                    strokeWidth={edge.onPath ? 3 : edge.lit ? 2.5 : 1.25}
                    strokeOpacity={
                      branch !== "ALL" && edge.branch !== branch ? 0.12 : edge.onPath ? 1 : edge.lit ? 0.9 : 0.32
                    }
                    strokeDasharray={edge.lit || edge.onPath ? undefined : "4 4"}
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </svg>

              <div className="clicker-skill-node is-hub" style={cellStyle(layout.hub)} aria-hidden>
                <span className="clicker-skill-node-glyph">◆</span>
              </div>

              {treeNodes.map((node) => {
                const status = node.status.toLowerCase()
                const dimmed = branch !== "ALL" && node.branch !== branch
                const showCost = node.status === "AVAILABLE" || node.status === "POOR"
                return (
                  <button
                    key={node.id}
                    type="button"
                    data-node-id={node.id}
                    tabIndex={selectedId === node.id ? 0 : -1}
                    className={`clicker-skill-node is-${status}${node.tier >= 5 ? " is-apex" : ""}${selectedId === node.id ? " is-selected" : ""}${pathIds.has(node.id) && selectedId !== node.id ? " is-path" : ""}${dimmed ? " is-dimmed" : ""}`}
                    style={{ ...cellStyle(node), "--branch-color": SKILL_BRANCH_COLOR[node.branch] } as CSSProperties}
                    aria-pressed={selectedId === node.id}
                    aria-label={`${node.name} · ${node.description} · ${statusLabel(node.status)} · ${formatNumber(node.cost)} CORE`}
                    onClick={() => setSelectedId(node.id)}
                    onPointerEnter={(e) => {
                      if (e.pointerType === "mouse" && !panning) setHoverId(node.id)
                    }}
                    onPointerLeave={() => setHoverId((h) => (h === node.id ? null : h))}
                  >
                    <span className="clicker-skill-node-glyph">
                      {node.status === "OWNED" ? "✓" : SKILL_BRANCH_GLYPH[node.branch]}
                    </span>
                    {showLabels ? (
                      <span className="clicker-skill-node-label" aria-hidden>
                        <b>{node.name}</b>
                        <i>{node.description}</i>
                      </span>
                    ) : showCost ? (
                      <span className="clicker-skill-node-cost" aria-hidden>
                        {formatNumber(node.cost)}
                      </span>
                    ) : null}
                  </button>
                )
              })}

              {hovered && hovered.id !== selectedId ? (
                <div
                  className={`clicker-skill-hovercard is-${hovered.status.toLowerCase()}`}
                  style={cellStyle(hovered)}
                  role="tooltip"
                >
                  <strong>{hovered.name}</strong>
                  <span>{hovered.description}</span>
                  <em>
                    {statusLabel(hovered.status)} · {formatNumber(hovered.cost)} CORE
                  </em>
                </div>
              ) : null}
            </div>
          </div>
          <div className="clicker-skill-zoom" role="group" aria-label="확대 · 축소">
            <button type="button" onClick={() => zoomTo(zoom - ZOOM_STEP)} disabled={zoom <= ZOOM_MIN} aria-label="축소">
              −
            </button>
            <span aria-live="polite">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => zoomTo(zoom + ZOOM_STEP)} disabled={zoom >= ZOOM_MAX} aria-label="확대">
              +
            </button>
            <button type="button" onClick={fitAll} aria-label="전체 보기">
              전체
            </button>
            <button
              type="button"
              onClick={() => centerOn(selected ?? layout.hub)}
              aria-label="선택한 회로로 이동"
              title="선택한 회로로 이동"
            >
              ◎
            </button>
          </div>
        </div>

        {selected ? (
          <aside
            className={`clicker-skill-detail is-${selected.status.toLowerCase()}`}
            style={{ "--branch-color": SKILL_BRANCH_COLOR[selected.branch] } as CSSProperties}
            aria-live="polite"
          >
            <div className="clicker-skill-detail-top">
              <div className="clicker-skill-detail-meta">
                <span aria-hidden>{SKILL_BRANCH_GLYPH[selected.branch]}</span> {SKILL_BRANCH_LABEL[selected.branch]} · T
                {selected.tier}
                {selected.tier >= 5 ? " · 정점" : ""}
              </div>
              <span className={`clicker-skill-detail-status is-${selected.status.toLowerCase()}`}>
                {statusLabel(selected.status)}
              </span>
            </div>
            <strong className="clicker-skill-detail-name">{selected.name}</strong>
            <p className="clicker-skill-detail-effect">{selected.description}</p>

            {selected.status !== "OWNED" ? (
              <div className="clicker-skill-detail-fund">
                <div className="clicker-skill-detail-stats">
                  <span>
                    비용 <strong>{formatNumber(selected.cost)}</strong>
                  </span>
                  {selected.status === "POOR" ? (
                    <span className="is-short">
                      부족 <strong>{formatNumber(shortBy)}</strong>
                    </span>
                  ) : null}
                </div>
                <div className="clicker-bar clicker-skill-detail-bar" aria-hidden>
                  <i style={{ width: `${Math.round(fundRatio * 100)}%` }} />
                </div>
              </div>
            ) : null}

            {selected.status === "LOCKED" ? (
              <div className="clicker-skill-detail-links">
                <span>선행 회로</span>
                {selected.requires.map((id) => {
                  const req = byId.get(id)
                  if (!req) return null
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`clicker-skill-chip is-${req.status.toLowerCase()}`}
                      onClick={() => select(id, true)}
                    >
                      {req.status === "OWNED" ? "✓ " : ""}
                      {req.name}
                    </button>
                  )
                })}
              </div>
            ) : null}

            <div className="clicker-skill-detail-actions">
              {selected.status === "LOCKED" ? (
                <button
                  className="clicker-primary"
                  type="button"
                  disabled={pathCost > coreEnergy}
                  onClick={buyPath}
                  aria-label={`경로 ${path.length}개 회로 모두 해금 · 합계 ${formatNumber(pathCost)} CORE`}
                >
                  {pathCost > coreEnergy
                    ? `경로 ${path.length}개 · ${formatNumber(pathCost)} CORE 필요`
                    : `경로 ${path.length}개 한 번에 해금 · ${formatNumber(pathCost)}`}
                </button>
              ) : (
                <button
                  className="clicker-primary"
                  type="button"
                  disabled={!selected.canBuy}
                  onClick={() => buy(selected)}
                >
                  {selected.status === "OWNED"
                    ? "활성화됨"
                    : selected.status === "POOR"
                      ? `CORE ${formatNumber(shortBy)} 더 필요`
                      : `${formatNumber(selected.cost)} CORE로 해금`}
                </button>
              )}
            </div>

            {nextOnes.length ? (
              <div className="clicker-skill-detail-links">
                <span>다음 회로</span>
                {nextOnes.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className={`clicker-skill-chip is-${n.status.toLowerCase()}`}
                    onClick={() => select(n.id, true)}
                  >
                    {n.status === "OWNED" ? "✓ " : ""}
                    {n.name}
                  </button>
                ))}
              </div>
            ) : null}

            <details
              className="clicker-skill-summary"
              open={summaryOpen}
              onToggle={(e) => setSummaryOpen(e.currentTarget.open)}
            >
              <summary>활성 효과 {ownedCount}</summary>
              {ownedCount ? (
                <ul>
                  {BRANCHES.map((b) => {
                    const owned = treeNodes.filter((n) => n.branch === b && n.status === "OWNED")
                    if (!owned.length) return null
                    return (
                      <li key={b} style={{ "--branch-color": SKILL_BRANCH_COLOR[b] } as CSSProperties}>
                        <strong>
                          {SKILL_BRANCH_GLYPH[b]} {SKILL_BRANCH_LABEL[b]}
                        </strong>
                        <span>{owned.map((n) => n.description).join(" · ")}</span>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p>아직 활성화한 회로가 없습니다.</p>
              )}
            </details>
          </aside>
        ) : null}
      </div>

      <p className="clicker-skill-tree-hint" aria-hidden>
        노드를 눌러 상세 보기 · 드래그로 이동 · Ctrl+휠로 확대 · 방향키로 노드 이동
      </p>
    </div>
  )
}
