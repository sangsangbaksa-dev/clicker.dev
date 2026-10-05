import { MINE_ORE_PLATE } from "@/data/clicker/mine-assets"
import { layoutOrePlate, type OrePlateLayout } from "@/domain/services/clicker-ore-plate"

export type { OrePlateLayout }

/** Shrunk ore box / tap target / ground shadow for a mine view of this size (data in `MINE_ORE_PLATE`, rules in domain). */
export function mineOreLayout(viewWidth: number, viewHeight: number): OrePlateLayout {
  return layoutOrePlate(viewWidth, viewHeight, MINE_ORE_PLATE, MINE_ORE_PLATE.fit, MINE_ORE_PLATE.shadow)
}
