/** Alpha threshold: a pixel counts as ore when its alpha is above this. */
export const ORE_ALPHA_THRESHOLD = 16

/** 1 byte per pixel, 1 = ore. */
export type AlphaMask = { width: number; height: number; data: Uint8Array }

/** RGBA pixel buffer (canvas ImageData layout) → opaque/transparent mask. */
export function buildAlphaMask(rgba: ArrayLike<number>, width: number, height: number, threshold = ORE_ALPHA_THRESHOLD): AlphaMask {
  const data = new Uint8Array(width * height)
  for (let i = 0; i < data.length; i++) data[i] = rgba[i * 4 + 3] > threshold ? 1 : 0
  return { width, height, data }
}

/** Is the pixel under (x, y) — in image coordinates — part of the ore? Outside the image = no. */
export function maskHit(mask: AlphaMask, x: number, y: number): boolean {
  const px = Math.floor(x)
  const py = Math.floor(y)
  if (px < 0 || py < 0 || px >= mask.width || py >= mask.height) return false
  return mask.data[py * mask.width + px] === 1
}

export type Rect = { left: number; top: number; width: number; height: number }
export type ObjectFit = "fill" | "contain" | "cover"

/**
 * Map a point (same space as `rect`, e.g. client px from getBoundingClientRect, which already
 * includes any CSS transform) to pixel coordinates of an image drawn in that rect with `fit`.
 * `extraScale` is an additional scale about the rect centre that the rect does not reflect.
 */
export function mapPointToImage(
  point: { x: number; y: number },
  rect: Rect,
  image: { width: number; height: number },
  fit: ObjectFit = "fill",
  extraScale = 1,
): { x: number; y: number } {
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const s = extraScale || 1
  const x = cx + (point.x - cx) / s
  const y = cy + (point.y - cy) / s
  let sx = rect.width / image.width
  let sy = rect.height / image.height
  if (fit === "contain") sx = sy = Math.min(sx, sy)
  else if (fit === "cover") sx = sy = Math.max(sx, sy)
  const drawnW = image.width * sx
  const drawnH = image.height * sy
  const ox = rect.left + (rect.width - drawnW) / 2
  const oy = rect.top + (rect.height - drawnH) / 2
  return { x: (x - ox) / sx, y: (y - oy) / sy }
}

/** Hit-test a point against an ore mask drawn in `rect`. Transparent pixels and letterbox do not count. */
export function oreHitTest(
  mask: AlphaMask,
  point: { x: number; y: number },
  rect: Rect,
  fit: ObjectFit = "fill",
  extraScale = 1,
): boolean {
  if (rect.width <= 0 || rect.height <= 0) return false
  const p = mapPointToImage(point, rect, mask, fit, extraScale)
  return maskHit(mask, p.x, p.y)
}
