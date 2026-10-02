import { coverPlacement, hitPose, idlePose, type Size } from "../domain/services/clicker-monster-fit.ts"

/** One frame of a monster picture: where the cover-fit puts it and how it moves right now. */
export function frameState(image: Size, viewport: Size, t: number, hitProgress: number | null, reducedMotion = false) {
  const place = coverPlacement(image, viewport)
  const pose = hitProgress !== null ? hitPose(hitProgress) : reducedMotion ? { dy: 0, scale: 1, rot: 0 } : idlePose(t)
  return { place, pose }
}

/** CSS transform for a frame (transform-origin must be 0 0). */
export function frameTransform(f: ReturnType<typeof frameState>): string {
  const { place, pose } = f
  return `translate(${place.x}px, ${place.y + pose.dy}px) scale(${place.scale * pose.scale}) rotate(${pose.rot}rad)`
}
