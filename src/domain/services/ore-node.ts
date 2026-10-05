export type OreNode = { readonly id: string; readonly x: number; readonly y: number }

export const SINGLE_CENTER_POSITION = { x: 0.5, y: 0.52 } as const

export const MAX_ORE_NODES = 1

/** Fraction of the shorter mine viewport edge used as the tap target square. */
export const ORE_HIT_SIZE_RATIO = 0.26

export function createCenterOre(): OreNode {
  return { id: "core-center", ...SINGLE_CENTER_POSITION }
}

export function oreStrikePoint(node: OreNode, width: number, height: number): { x: number; y: number } {
  return { x: node.x * width, y: node.y * height }
}

export function oreHitBox(node: OreNode, width: number, height: number): {
  left: number
  top: number
  width: number
  height: number
} {
  const edge = Math.min(width, height) * ORE_HIT_SIZE_RATIO
  const cx = node.x * width
  const cy = node.y * height
  return { left: cx - edge / 2, top: cy - edge / 2, width: edge, height: edge }
}

export function spawnMineOres(): readonly OreNode[] {
  return [createCenterOre()].slice(0, MAX_ORE_NODES)
}
