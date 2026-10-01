/** Holding Space auto-clicks this many times a second (own timer, key-repeat ignored). */
export const SPACE_HOLD_CPS = 5
export const SPACE_HOLD_INTERVAL_MS = 1000 / SPACE_HOLD_CPS

export type Point = { x: number; y: number }

export type SpaceKeyInput = {
  code: string
  repeat: boolean
  ctrl: boolean
  meta: boolean
  alt: boolean
  typing: boolean
  modalOpen: boolean
  holding: boolean
}

export function decideSpaceKeydown(i: SpaceKeyInput): "start" | "swallow" | "ignore" {
  if (i.code !== "Space" || i.ctrl || i.meta || i.alt) return "ignore"
  if (i.typing || i.modalOpen) return "ignore"
  if (i.repeat || i.holding) return "swallow"
  return "start"
}

export function isTypingTarget(tagName: string | null | undefined, editable: boolean): boolean {
  return editable || /^(INPUT|TEXTAREA|SELECT)$/i.test(tagName ?? "")
}

export function resolveSpacePoint(lastPointer: Point | null, oreCenter: Point): Point {
  return lastPointer ?? oreCenter
}
