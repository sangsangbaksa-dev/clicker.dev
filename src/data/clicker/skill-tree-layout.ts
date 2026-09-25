import type { SkillBranch, SkillNodeDef } from "@/domain/entities/clicker"

export type SkillCell = { col: number; row: number }

export type SkillTreeLayout = {
  cells: Record<string, SkillCell>
  hub: SkillCell
  cols: number
  rows: number
}

/** Right side grows FOCUS then RESONANCE; left side AUTOMATION then TRANSCENDENCE. */
const SIDES: Array<{ dir: 1 | -1; branches: SkillBranch[] }> = [
  { dir: 1, branches: ["FOCUS", "RESONANCE"] },
  { dir: -1, branches: ["AUTOMATION", "TRANSCENDENCE"] },
]

type LayoutNode = Pick<SkillNodeDef, "id" | "branch" | "requires">

/**
 * Grid layout: depth (longest prerequisite chain) sets the column, a node's first
 * prerequisite is its layout parent, and the first child continues the parent's row so
 * main lines stay straight. Positions never depend on what is owned.
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

  const cells: Record<string, SkillCell> = {}
  let maxDepth = 0
  let rows = 0
  for (const side of SIDES) {
    let nextRow = 0
    const place = (id: string): number => {
      const kids = children.get(id) ?? []
      let row = nextRow
      if (kids.length) {
        row = place(kids[0])
        for (const kid of kids.slice(1)) place(kid)
      } else {
        nextRow += 1
      }
      const d = depthOf(id)
      maxDepth = Math.max(maxDepth, d)
      cells[id] = { col: side.dir * (d + 1), row }
      return row
    }
    side.branches.forEach((branch, i) => {
      if (i > 0 && nextRow > 0) nextRow += 1
      const start = nextRow
      const roots = nodes.filter((n) => n.branch === branch && !n.requires?.some((r) => byId.has(r)))
      for (const root of roots) place(root.id)
      // The upper branch is mirrored so its main line sits next to the hub, like the lower one.
      if (i === 0) {
        const end = nextRow - 1
        for (const node of nodes) {
          if (node.branch === branch && cells[node.id]) cells[node.id].row = start + end - cells[node.id].row
        }
      }
    })
    rows = Math.max(rows, nextRow)
  }
  const half = maxDepth + 1
  for (const cell of Object.values(cells)) cell.col += half
  return { cells, hub: { col: half, row: Math.floor((rows - 1) / 2) }, cols: half * 2 + 1, rows }
}

/**
 * Orthogonal connector: run along the parent's row, turn at the half-column just before
 * the child, then run along the child's row. Only horizontal and vertical segments.
 */
export function orthogonalPath(from: SkillCell, to: SkillCell): string {
  const turn = to.col - 0.5 * Math.sign(to.col - from.col || 1)
  const x = (c: number) => c + 0.5
  const y = (r: number) => r + 0.5
  return `M${x(from.col)} ${y(from.row)}H${x(turn)}V${y(to.row)}H${x(to.col)}`
}

export const SKILL_BRANCH_LABEL: Record<SkillBranch, string> = {
  FOCUS: "직접 개입",
  AUTOMATION: "자동화",
  RESONANCE: "공명",
  TRANSCENDENCE: "초월",
}

export const SKILL_BRANCH_COLOR: Record<SkillBranch, string> = {
  FOCUS: "#62d8eb",
  AUTOMATION: "#6fd9b0",
  RESONANCE: "#a98cff",
  TRANSCENDENCE: "#e8c468",
}

export const SKILL_BRANCH_GLYPH: Record<SkillBranch, string> = {
  FOCUS: "⚡",
  AUTOMATION: "⚙",
  RESONANCE: "◎",
  TRANSCENDENCE: "✦",
}
