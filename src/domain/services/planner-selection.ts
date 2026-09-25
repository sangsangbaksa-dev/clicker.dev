import {
  PLANNER_WEEKEND_DAYS,
  PLANNER_WEEKEND_SLOTS,
  cellKey,
  isPlannerSlotAvailable,
  isWeekendSlotId,
  type PlannerCell,
  type PlannerDayId,
} from "@/domain/entities/planner"

export type WeekendGridPoint = {
  dayId: PlannerDayId
  slotId: string
}

export type WeekendSelection = {
  dayIds: PlannerDayId[]
  startSlotId: string
  span: number
  keys: Set<string>
}

export function spanSlotsForCell(cell: PlannerCell): number {
  if (!isWeekendSlotId(cell.periodId)) return 1
  const raw = cell.spanSlots
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 1
  return Math.max(1, Math.floor(raw))
}

export function weekendSlotIndex(slotId: string): number {
  return PLANNER_WEEKEND_SLOTS.findIndex((slot) => slot.id === slotId)
}

export function coveredWeekendSlotIds(startSlotId: string, span: number): string[] {
  const start = weekendSlotIndex(startSlotId)
  if (start < 0) return []
  return PLANNER_WEEKEND_SLOTS.slice(start, start + Math.max(1, span)).map((slot) => slot.id)
}

export function clampWeekendSpan(
  dayId: PlannerDayId,
  startSlotId: string,
  span: number
): number {
  const start = weekendSlotIndex(startSlotId)
  if (start < 0) return 1
  const requested = Math.max(1, Math.floor(span))
  let count = 0
  for (let i = start; i < PLANNER_WEEKEND_SLOTS.length && count < requested; i++) {
    if (!isPlannerSlotAvailable(dayId, PLANNER_WEEKEND_SLOTS[i].id)) break
    count++
  }
  return Math.max(1, count)
}

export function weekendRangeLabel(startSlotId: string, span: number): string {
  const ids = coveredWeekendSlotIds(startSlotId, span)
  if (!ids.length) return ""
  const first = PLANNER_WEEKEND_SLOTS[weekendSlotIndex(ids[0])]
  const last = PLANNER_WEEKEND_SLOTS[weekendSlotIndex(ids[ids.length - 1])]
  if (!first || !last) return ""
  const end = last.time.split("–")[1] ?? last.label
  return `${first.label}–${end}`
}

export function coverageKeys(cell: PlannerCell): string[] {
  if (!isWeekendSlotId(cell.periodId)) {
    return [cellKey(cell.weekdayId, cell.periodId)]
  }
  const span = clampWeekendSpan(cell.weekdayId, cell.periodId, spanSlotsForCell(cell))
  return coveredWeekendSlotIds(cell.periodId, span)
    .filter((id) => isPlannerSlotAvailable(cell.weekdayId, id))
    .map((id) => cellKey(cell.weekdayId, id))
}

export function findCellCovering(
  cells: readonly PlannerCell[],
  dayId: PlannerDayId,
  periodId: string
): PlannerCell | null {
  const key = cellKey(dayId, periodId)
  for (const cell of cells) {
    if (coverageKeys(cell).includes(key)) return cell
  }
  return null
}

function indexRange(from: number, to: number): number[] {
  if (from < 0 || to < 0) return []
  const start = Math.min(from, to)
  const end = Math.max(from, to)
  const ids: number[] = []
  for (let i = start; i <= end; i++) ids.push(i)
  return ids
}

export function weekendSelectionFromPoints(
  origin: WeekendGridPoint,
  current: WeekendGridPoint
): WeekendSelection {
  const days = PLANNER_WEEKEND_DAYS.map((day) => day.id)
  const slots = PLANNER_WEEKEND_SLOTS.map((slot) => slot.id)
  const dayIdx = indexRange(
    days.findIndex((id) => id === origin.dayId),
    days.findIndex((id) => id === current.dayId)
  )
  const slotIdx = indexRange(
    weekendSlotIndex(origin.slotId),
    weekendSlotIndex(current.slotId)
  )
  const dayIds = (dayIdx.length ? dayIdx : [0]).map((index) => days[index] ?? origin.dayId)
  const startSlotId = slots[slotIdx[0] ?? 0] ?? origin.slotId
  const span = slotIdx.length || 1
  const keys = new Set<string>()
  for (const dayId of dayIds) {
    for (const index of slotIdx.length ? slotIdx : [weekendSlotIndex(origin.slotId)]) {
      const slotId = slots[index]
      if (slotId && isPlannerSlotAvailable(dayId, slotId)) {
        keys.add(cellKey(dayId, slotId))
      }
    }
  }
  return { dayIds, startSlotId, span, keys }
}

export function daySpanInSelection(
  dayId: PlannerDayId,
  selection: WeekendSelection
): { periodId: string; spanSlots: number } | null {
  const ids = coveredWeekendSlotIds(selection.startSlotId, selection.span).filter((id) =>
    isPlannerSlotAvailable(dayId, id)
  )
  if (!ids.length) return null
  return {
    periodId: ids[0],
    spanSlots: clampWeekendSpan(dayId, ids[0], ids.length),
  }
}

export function weekendPointFromClientPoint(
  clientX: number,
  clientY: number
): WeekendGridPoint | null {
  const el = document.elementFromPoint(clientX, clientY)
  const host = el?.closest("[data-planner-day][data-planner-slot]")
  if (!(host instanceof HTMLElement)) return null
  const dayId = host.dataset.plannerDay as PlannerDayId | undefined
  const slotId = host.dataset.plannerSlot
  if (!dayId || !slotId) return null
  if (!isPlannerSlotAvailable(dayId, slotId)) return null
  return { dayId, slotId }
}
