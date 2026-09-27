import type { SkillBranch, SkillNodeDef } from "@/domain/entities/clicker"

export type SkillCell = { col: number; row: number }

export type SkillTreeLayout = {
  cells: Record<string, SkillCell>
  hub: SkillCell
  cols: number
  rows: number
}

/** Five branches around the hub, one per pentagon corner, clockwise from the top. */
export const SKILL_BRANCH_ORDER: SkillBranch[] = ["FOCUS", "AUTOMATION", "RESONANCE", "HUNT", "TRANSCENDENCE"]

type LayoutNode = Pick<SkillNodeDef, "id" | "branch" | "requires">

/** Distance from the hub to a branch's first circuit, and between depth rings (in cells). */
const RING0 = 2.4
const RING_STEP = 1.35
/** Half of the angle a branch fans across. */
const FAN = (30 * Math.PI) / 180
/** Nodes closer than this (in cells) get pushed apart. */
const MIN_GAP = 1.2

/**
 * Radial layout: the five branch roots sit on a pentagon around the hub and each branch
 * fans outward — depth sets the ring, leaf order sets the angle within the branch's wedge.
 * A short relaxation pass then pushes apart anything that landed too close. Deterministic,
 * and positions never depend on what is owned.
 */
export function layoutSkillTree(nodes: LayoutNode[]): SkillTreeLayout {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const depth = new Map<string, number>()
  const depthOf = (id: string): number => {
    const known = depth.get(id)
    if (known !== undefined) return known
    const reqs = (byId.get(id)?.requires ?? []).filter((r) => byId.has(r))
    const d = reqs.length ? Math.max(...reqs.map(depthOf)) + 1 : 0
    depth.set(id, d)
    return d
  }
  const children = new Map<string, string[]>()
  for (const node of nodes) {
    const parent = node.requires?.find((r) => byId.has(r))
    if (parent) children.set(parent, [...(children.get(parent) ?? []), node.id])
  }

  const pos = new Map<string, { x: number; y: number }>()
  const pinned = new Set<string>()
  const branches = [...SKILL_BRANCH_ORDER, ...new Set(nodes.map((n) => n.branch).filter((b) => !SKILL_BRANCH_ORDER.includes(b)))]
  branches.forEach((branch, i) => {
    const theta = -Math.PI / 2 + (i * 2 * Math.PI) / branches.length
    const roots = nodes.filter((n) => n.branch === branch && !n.requires?.some((r) => byId.has(r)))
    // Leaf slots in DFS order; a parent sits at the mean of its children's slots.
    const slot = new Map<string, number>()
    let leaves = 0
    const walk = (id: string): number => {
      const kids = children.get(id) ?? []
      const v = kids.length ? kids.map(walk).reduce((a, b) => a + b, 0) / kids.length : leaves++
      slot.set(id, v)
      return v
    }
    for (const root of roots) walk(root.id)
    const mid = (leaves - 1) / 2
    for (const [id, v] of slot) {
      const angle = theta + (leaves > 1 ? ((v - mid) / mid) * FAN : 0)
      const r = RING0 + depthOf(id) * RING_STEP
      pos.set(id, { x: Math.cos(angle) * r, y: Math.sin(angle) * r })
    }
    for (const root of roots) pinned.add(root.id)
  })

  // Relax: push overlapping nodes apart; roots stay on the pentagon.
  const ids = [...pos.keys()]
  for (let iter = 0; iter < 160; iter++) {
    let moved = false
    for (let a = 0; a < ids.length; a++) {
      const pa = pos.get(ids[a])!
      for (let b = a + 1; b < ids.length; b++) {
        const pb = pos.get(ids[b])!
        let dx = pb.x - pa.x
        let dy = pb.y - pa.y
        let d = Math.hypot(dx, dy)
        if (d >= MIN_GAP) continue
        if (d < 1e-6) {
          dx = Math.cos(a + b)
          dy = Math.sin(a + b)
          d = 1
        }
        const push = (MIN_GAP - d) / 2 + 0.01
        const ux = dx / d
        const uy = dy / d
        const fa = pinned.has(ids[a]) ? 0 : pinned.has(ids[b]) ? 2 : 1
        const fb = pinned.has(ids[b]) ? 0 : pinned.has(ids[a]) ? 2 : 1
        pa.x -= ux * push * fa
        pa.y -= uy * push * fa
        pb.x += ux * push * fb
        pb.y += uy * push * fb
        moved = true
      }
      // Keep clear of the hub emblem.
      const r = Math.hypot(pa.x, pa.y)
      if (r < RING0 * 0.9 && !pinned.has(ids[a])) {
        pa.x *= (RING0 * 0.9) / Math.max(r, 1e-6)
        pa.y *= (RING0 * 0.9) / Math.max(r, 1e-6)
      }
    }
    if (!moved) break
  }

  const pad = 1
  const xs = [0, ...[...pos.values()].map((p) => p.x)]
  const ys = [0, ...[...pos.values()].map((p) => p.y)]
  const minX = Math.min(...xs) - pad
  const minY = Math.min(...ys) - pad
  const cells: Record<string, SkillCell> = {}
  for (const [id, p] of pos) cells[id] = { col: p.x - minX, row: p.y - minY }
  return {
    cells,
    hub: { col: -minX, row: -minY },
    cols: Math.max(...xs) - minX + pad + 1,
    rows: Math.max(...ys) - minY + pad + 1,
  }
}

/** Straight connector between two cell centres. */
export function connectorPath(from: SkillCell, to: SkillCell): string {
  const f = (n: number) => (n + 0.5).toFixed(3)
  return `M${f(from.col)} ${f(from.row)}L${f(to.col)} ${f(to.row)}`
}

export const SKILL_BRANCH_LABEL: Record<SkillBranch, string> = {
  FOCUS: "직접 개입",
  AUTOMATION: "자동화",
  RESONANCE: "공명",
  TRANSCENDENCE: "초월",
  HUNT: "사냥",
}

export const SKILL_BRANCH_COLOR: Record<SkillBranch, string> = {
  FOCUS: "#62d8eb",
  AUTOMATION: "#6fd9b0",
  RESONANCE: "#a98cff",
  TRANSCENDENCE: "#e8c468",
  HUNT: "#ff7a5c",
}

export const SKILL_BRANCH_GLYPH: Record<SkillBranch, string> = {
  FOCUS: "⚡",
  AUTOMATION: "⚙",
  RESONANCE: "◎",
  TRANSCENDENCE: "✦",
  HUNT: "⚔",
}
