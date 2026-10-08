/** Half-size of a skill-map node in board px (includes a small margin). */
export function skillmapNodeRadius(tier: number): number {
  const size = tier >= 5 ? 74 : 62
  return size / 2 + 6
}

export type SkillmapFitNode = { col: number; row: number; tier: number }

export type SkillmapFitResult = { panX: number; panY: number; scale: number }

/**
 * Initial pan + scale so every visible node fits inside the viewport (with padding).
 * Pan is applied before scale with transform-origin at the board's top-left.
 */
export function fitSkillmapView(input: {
  nodes: SkillmapFitNode[]
  cell: number
  viewW: number
  viewH: number
  pad?: number
}): SkillmapFitResult {
  const { nodes, cell, viewW, viewH, pad = 28 } = input
  if (!nodes.length || viewW <= 0 || viewH <= 0) return { panX: 0, panY: 0, scale: 1 }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const node of nodes) {
    const cx = (node.col + 0.5) * cell
    const cy = (node.row + 0.5) * cell
    const r = skillmapNodeRadius(node.tier)
    minX = Math.min(minX, cx - r)
    maxX = Math.max(maxX, cx + r)
    minY = Math.min(minY, cy - r)
    maxY = Math.max(maxY, cy + r)
  }

  const contentW = Math.max(1, maxX - minX)
  const contentH = Math.max(1, maxY - minY)
  const scale = Math.min(1, (viewW - pad * 2) / contentW, (viewH - pad * 2) / contentH)
  const panX = (viewW - contentW * scale) / 2 - minX * scale
  const panY = (viewH - contentH * scale) / 2 - minY * scale
  return { panX, panY, scale }
}

export function clampSkillmapPan(input: {
  panX: number
  panY: number
  scale: number
  boardW: number
  boardH: number
  viewW: number
  viewH: number
  pad?: number
}): { panX: number; panY: number } {
  let { panX, panY } = input
  const { scale, boardW, boardH, viewW, viewH, pad = 28 } = input
  const sw = boardW * scale
  const sh = boardH * scale
  if (sw <= viewW - pad * 2) {
    panX = (viewW - sw) / 2
  } else {
    panX = Math.min(pad, Math.max(viewW - sw - pad, panX))
  }
  if (sh <= viewH - pad * 2) {
    panY = (viewH - sh) / 2
  } else {
    panY = Math.min(pad, Math.max(viewH - sh - pad, panY))
  }
  return { panX, panY }
}
