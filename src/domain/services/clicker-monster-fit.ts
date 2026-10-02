// Pure math for painted monster art (no DOM). Based on Waldode's monster-fit-motion patch.
export type Size = { readonly w: number; readonly h: number }
export type Placement = { readonly scale: number; readonly x: number; readonly y: number }

/** 'cover': the image fills the whole viewport (overflow is cropped). `anchorY` keeps the face in view. */
export function coverPlacement(image: Size, viewport: Size, anchorY = 0.35): Placement {
  const scale = Math.max(viewport.w / image.w, viewport.h / image.h)
  const w = image.w * scale
  const h = image.h * scale
  return { scale, x: (viewport.w - w) / 2, y: (viewport.h - h) * anchorY }
}

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

export type Pose = { readonly dy: number; readonly scale: number; readonly rot: number }

/** Slow breathing + tiny sway; layered sines at different periods avoid a robotic loop. `t` in seconds. */
export function idlePose(t: number): Pose {
  return {
    dy: Math.sin(t * 1.6) * 4 + Math.sin(t * 0.7) * 2,
    scale: 1 + Math.sin(t * 1.6) * 0.008,
    rot: Math.sin(t * 0.9) * 0.004,
  }
}

/** Hit recoil: quick squash then eased return. `p` in [0,1]. */
export function hitPose(p: number): Pose {
  const k = 1 - easeOutCubic(Math.min(Math.max(p, 0), 1))
  return { dy: 10 * k, scale: 1 - 0.04 * k, rot: 0.01 * k }
}
