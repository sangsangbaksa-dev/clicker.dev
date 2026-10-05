export type SkillMapSize = { readonly w: number; readonly h: number }

/** Board-space rectangle. `x`/`y` are the top-left in the same pixels as the board. */
export type SkillMapRect = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

export type SkillMapView = { readonly x: number; readonly y: number; readonly scale: number }

export type SkillMapMarker = { readonly x: number; readonly y: number; readonly r: number }

const positive = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0)

/**
 * Box around marker centres, expanded by each marker's radius and `pad`.
 * Returns null when nothing finite was given.
 */
export function skillMapContentBounds(markers: readonly SkillMapMarker[], pad = 0): SkillMapRect | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const marker of markers) {
    if (!Number.isFinite(marker.x) || !Number.isFinite(marker.y)) continue
    const r = Number.isFinite(marker.r) && marker.r > 0 ? marker.r : 0
    minX = Math.min(minX, marker.x - r)
    minY = Math.min(minY, marker.y - r)
    maxX = Math.max(maxX, marker.x + r)
    maxY = Math.max(maxY, marker.y + r)
  }
  if (!Number.isFinite(minX) || maxX <= minX || maxY <= minY) return null
  const extra = Math.max(0, Number.isFinite(pad) ? pad : 0)
  return { x: minX - extra, y: minY - extra, w: maxX - minX + extra * 2, h: maxY - minY + extra * 2 }
}

/**
 * Opening camera. Scale is the largest value ≤ 1 that fits `content` inside the view,
 * then the content is centered. Translation is in view pixels and is applied after scale
 * (transform-origin 0 0), so a board point `p` lands at `view = translate + p * scale`.
 * `inset` is the gap kept around the content.
 */
export function skillMapInitialView(view: SkillMapSize, content: SkillMapRect, inset = 16): SkillMapView {
  const vw = positive(view.w)
  const vh = positive(view.h)
  const bw = positive(content.w)
  const bh = positive(content.h)
  if (!vw || !vh || !bw || !bh) return { x: 0, y: 0, scale: 1 }
  const gap = Math.max(0, Number.isFinite(inset) ? inset : 0)
  const innerW = Math.max(1, vw - gap * 2)
  const innerH = Math.max(1, vh - gap * 2)
  const scale = Math.min(1, innerW / bw, innerH / bh)
  const cx = (Number.isFinite(content.x) ? content.x : 0) + bw / 2
  const cy = (Number.isFinite(content.y) ? content.y : 0) + bh / 2
  return {
    scale,
    x: vw / 2 - cx * scale,
    y: vh / 2 - cy * scale,
  }
}

/**
 * Pan limits in view pixels. Translation is applied after scale, so `x`/`y` are the
 * board's visual top-left. A board that already fits stays near its centered spot.
 * A board larger than the view can travel until each edge has been `pad` px past the view.
 */
export function clampSkillMapPan(
  pan: { readonly x: number; readonly y: number },
  view: SkillMapSize,
  board: SkillMapSize,
  scale: number,
  pad = 48,
): { x: number; y: number } {
  const vw = positive(view.w) || 1
  const vh = positive(view.h) || 1
  const s = positive(scale) || 1
  const bw = (positive(board.w) || 1) * s
  const bh = (positive(board.h) || 1) * s
  const slack = Math.max(0, Number.isFinite(pad) ? pad : 0)
  return {
    x: clampAxis(Number.isFinite(pan.x) ? pan.x : 0, vw, bw, slack),
    y: clampAxis(Number.isFinite(pan.y) ? pan.y : 0, vh, bh, slack),
  }
}

function clampAxis(value: number, view: number, size: number, slack: number): number {
  if (size <= view) {
    const centered = (view - size) / 2
    return Math.min(centered + slack, Math.max(centered - slack, value))
  }
  return Math.min(slack, Math.max(view - size - slack, value))
}
