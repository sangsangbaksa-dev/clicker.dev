/**
 * Core-mine ore plate geometry (pure; no DOM, no assets).
 *
 * The mine draws one full-bleed "plate" picture (`background-size: cover`, centred). The mine-entry video ends on
 * the same room with a SMALLER crystal, so the live crystal is the big one (cropped from the ORIGINAL plate, which
 * still has it baked in) shrunk in code to the video's last frame, drawn over a CLEAN plate (no crystal, rubble or
 * baked contact shadow — Waldomage's clean plate), plus a small ground shadow:
 *   - `source.ore`   where the big crystal sits inside the original plate picture (plate px),
 *   - `fit`          the shrink factor (<= 1, never an upscale) and where its centre lands (plate px),
 *   - `shadow`       a soft ellipse under the shrunk crystal, defined in fractions of the shrunk ore box.
 * The click/hit box is the rendered box — one number, two consumers — so what you see is what you tap.
 */

export type OreBounds = { x: number; y: number; w: number; h: number }
/** The plate picture (its pixel size only sets the aspect) and the baked crystal's bounds inside it. */
export type OrePlateSource = { width: number; height: number; ore: OreBounds }
/** Shrunk crystal: factor relative to the baked crystal (<= 1) and its centre in plate px. */
export type OreFit = { scale: number; centerX: number; centerY: number }
/**
 * Ground shadow under the shrunk crystal, all in fractions of the RENDERED ore box: ellipse centre at
 * (`cx` x width, `cy` x height) from the box's top-left, half-axes `rx` x width and `ry` x height, peak opacity `alpha`.
 */
export type OreShadow = { cx: number; cy: number; rx: number; ry: number; alpha: number }
export type Rect = { left: number; top: number; width: number; height: number }

/** Smallest shrink we accept (a typo like 0.01 must not make an untappable ore). */
export const MIN_ORE_SHRINK = 0.2

/** The shrink factor actually used: finite, in [MIN_ORE_SHRINK, 1]. Anything invalid means "no shrink". */
export function clampOreShrink(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) return 1
  return Math.min(1, Math.max(MIN_ORE_SHRINK, scale))
}

export type CoverFit = { scale: number; left: number; top: number }

/** `background-size: cover` + `center`: scale and top-left of the picture inside a view. */
export function coverFit(viewWidth: number, viewHeight: number, imageWidth: number, imageHeight: number): CoverFit {
  const ok = (n: number) => Number.isFinite(n) && n > 0
  if (!ok(viewWidth) || !ok(viewHeight) || !ok(imageWidth) || !ok(imageHeight)) return { scale: 0, left: 0, top: 0 }
  const scale = Math.max(viewWidth / imageWidth, viewHeight / imageHeight)
  return { scale, left: (viewWidth - imageWidth * scale) / 2, top: (viewHeight - imageHeight * scale) / 2 }
}

export type OrePlateLayout = {
  cover: CoverFit
  /** Effective shrink (<= 1). */
  shrink: number
  /** The baked big crystal's box in view px — what the mine used before the shrink (reference only). */
  legacy: Rect
  /** The shrunk crystal's box in view px. */
  rendered: Rect
  /** Tap / aim target — always exactly `rendered`. */
  hit: Rect
  /** Crop of the plate drawn inside `rendered`: `background-size` + `background-position`, px. */
  art: { width: number; height: number; x: number; y: number }
  /** Bounding box (view px) of the ground-shadow ellipse under the shrunk crystal, and its peak opacity (0..1; 0 = none). */
  shadow: { rect: Rect; alpha: number }
}

const EMPTY: Rect = { left: 0, top: 0, width: 0, height: 0 }

/** Where the shrunk crystal, its tap target and its ground shadow go for a view of `viewWidth` x `viewHeight`. */
export function layoutOrePlate(
  viewWidth: number,
  viewHeight: number,
  source: OrePlateSource,
  fit: OreFit,
  shadow: OreShadow,
): OrePlateLayout {
  const cover = coverFit(viewWidth, viewHeight, source.width, source.height)
  const shrink = clampOreShrink(fit.scale)
  const { ore } = source
  const k = cover.scale
  const toView = (x: number, y: number, w: number, h: number): Rect => ({
    left: cover.left + x * k,
    top: cover.top + y * k,
    width: w * k,
    height: h * k,
  })
  if (k === 0) {
    return { cover, shrink, legacy: EMPTY, rendered: EMPTY, hit: EMPTY, art: { width: 0, height: 0, x: 0, y: 0 }, shadow: { rect: EMPTY, alpha: 0 } }
  }
  const legacy = toView(ore.x, ore.y, ore.w, ore.h)
  const w = ore.w * shrink
  const h = ore.h * shrink
  const rendered = toView(fit.centerX - w / 2, fit.centerY - h / 2, w, h)
  const pos = (n: number) => Number.isFinite(n) && n > 0
  const shadowOk = pos(shadow.rx) && pos(shadow.ry) && Number.isFinite(shadow.cx) && Number.isFinite(shadow.cy) && Number.isFinite(shadow.alpha)
  const shadowRect: Rect = shadowOk
    ? {
        left: rendered.left + (shadow.cx - shadow.rx) * rendered.width,
        top: rendered.top + (shadow.cy - shadow.ry) * rendered.height,
        width: 2 * shadow.rx * rendered.width,
        height: 2 * shadow.ry * rendered.height,
      }
    : EMPTY
  return {
    cover,
    shrink,
    legacy,
    rendered,
    hit: { ...rendered },
    art: {
      width: source.width * k * shrink,
      height: source.height * k * shrink,
      x: -ore.x * k * shrink,
      y: -ore.y * k * shrink,
    },
    shadow: { rect: shadowRect, alpha: shadowOk ? Math.min(1, Math.max(0, shadow.alpha)) : 0 },
  }
}

/** Is the view point inside the tap target? (Edges count.) */
export function isInsideRect(rect: Rect, x: number, y: number): boolean {
  return x >= rect.left && x <= rect.left + rect.width && y >= rect.top && y <= rect.top + rect.height
}
