import { createCenterOre, MAX_ORE_NODES, type OreNode } from "../domain/services/ore-node.ts"

export function spawnMineOres(): readonly OreNode[] {
  return [createCenterOre()].slice(0, MAX_ORE_NODES)
}
