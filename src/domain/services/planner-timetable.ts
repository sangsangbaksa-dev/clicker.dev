import {
  cellHasContent,
  cellKey,
  isPlannerSlotAvailable,
  isWeekendSlotId,
  plannerTodoText,
  plannerWeekKey,
  type PlannerCell,
  type PlannerDayId,
  type PlannerPeriodId,
  type PlannerTimetable,
  type PlannerTodo,
} from "@/domain/entities/planner"
import {
  clampWeekendSpan,
  coverageKeys,
  findCellCovering,
  spanSlotsForCell,
} from "@/domain/services/planner-selection"

const FRIDAY_PERIOD_TO_WEEKEND: Record<string, string> = {
  "8": "we-1630",
  night1: "we-1900",
  night2: "we-2000",
  night3: "we-2100",
  dorm1: "we-2200",
  dorm2: "we-2300",
}

const VALID_DAYS = new Set<PlannerDayId>(["mon", "tue", "wed", "thu", "fri", "sat", "sun"])

function migrateFridayAfterSchool(cell: PlannerCell): PlannerCell {
  if (cell.weekdayId !== "fri") return cell
  const mapped = FRIDAY_PERIOD_TO_WEEKEND[cell.periodId]
  if (!mapped) return cell
  return { ...cell, periodId: mapped }
}

export function normalizeTodos(todos: unknown): PlannerTodo[] | undefined {
  if (!Array.isArray(todos)) return undefined
  const cleaned: PlannerTodo[] = []
  for (const item of todos) {
    if (typeof item === "string") {
      const text = item.trim()
      if (text) cleaned.push({ text })
      continue
    }
    if (item && typeof item === "object" && "text" in item) {
      const text = String((item as PlannerTodo).text ?? "").trim()
      if (!text) continue
      cleaned.push((item as PlannerTodo).weekly ? { text, weekly: true } : { text })
    }
  }
  return cleaned.length ? cleaned : undefined
}

function normalizeCell(input: PlannerCell): PlannerCell | null {
  if (!VALID_DAYS.has(input.weekdayId)) return null
  const migrated = migrateFridayAfterSchool({
    weekdayId: input.weekdayId,
    periodId: String(input.periodId ?? ""),
    label: String(input.label ?? "").trim(),
    colorId: input.colorId ?? "teal",
    room: input.room?.trim() || undefined,
    memo: input.memo?.trim() || undefined,
    todos: normalizeTodos(input.todos),
    weekly: input.weekly ? true : undefined,
    spanSlots: input.spanSlots,
  })
  if (!isPlannerSlotAvailable(migrated.weekdayId, migrated.periodId)) return null
  if (!cellHasContent(migrated)) return null
  if (!isWeekendSlotId(migrated.periodId)) {
    const { spanSlots: _span, ...rest } = migrated
    return rest
  }
  const span = clampWeekendSpan(
    migrated.weekdayId,
    migrated.periodId,
    spanSlotsForCell(migrated)
  )
  return span > 1 ? { ...migrated, spanSlots: span } : { ...migrated, spanSlots: undefined }
}

export function normalizeTimetable(input: PlannerTimetable | null | undefined): PlannerTimetable {
  if (!input?.cells?.length) {
    return { cells: [], weekKey: input?.weekKey }
  }
  const cells: PlannerCell[] = []
  const occupied = new Set<string>()
  for (const raw of input.cells) {
    const cell = normalizeCell(raw)
    if (!cell) continue
    const keys = coverageKeys(cell)
    if (keys.some((key) => occupied.has(key))) continue
    for (const key of keys) occupied.add(key)
    cells.push(cell)
  }
  return { cells, weekKey: input.weekKey }
}

export function upsertPlannerCell(
  timetable: PlannerTimetable,
  cell: PlannerCell
): PlannerTimetable {
  const next = normalizeCell({
    ...cell,
    label: cell.label.trim(),
    room: cell.room?.trim() || undefined,
    memo: cell.memo?.trim() || undefined,
    todos: normalizeTodos(cell.todos),
  })
  if (!next) {
    return {
      cells: timetable.cells.filter(
        (item) => cellKey(item.weekdayId, item.periodId) !== cellKey(cell.weekdayId, cell.periodId)
      ),
      weekKey: timetable.weekKey,
    }
  }
  const covered = new Set(coverageKeys(next))
  const rest = timetable.cells.filter(
    (item) => !coverageKeys(item).some((key) => covered.has(key))
  )
  return {
    cells: [...rest, next],
    weekKey: timetable.weekKey,
  }
}

export function removePlannerCell(
  timetable: PlannerTimetable,
  weekdayId: PlannerDayId,
  periodId: PlannerPeriodId
): PlannerTimetable {
  const key = cellKey(weekdayId, periodId)
  return {
    cells: timetable.cells.filter((item) => cellKey(item.weekdayId, item.periodId) !== key),
    weekKey: timetable.weekKey,
  }
}

export function addTaskToPlannerCell(
  timetable: PlannerTimetable,
  weekdayId: PlannerDayId,
  periodId: PlannerPeriodId,
  task: { title: string; notes?: string; weekly?: boolean }
): PlannerTimetable {
  const title = task.title.trim()
  if (!title) return timetable
  if (!isPlannerSlotAvailable(weekdayId, periodId)) return timetable
  const existing = findCellCovering(timetable.cells, weekdayId, periodId)
  const todos = [...(existing?.todos ?? [])]
  if (!todos.some((todo) => plannerTodoText(todo) === title)) {
    todos.push(task.weekly ? { text: title, weekly: true } : { text: title })
  }
  return upsertPlannerCell(timetable, {
    weekdayId: existing?.weekdayId ?? weekdayId,
    periodId: existing?.periodId ?? periodId,
    label: existing?.label?.trim() || title,
    colorId: existing?.colorId ?? "teal",
    room: existing?.room,
    memo: existing?.memo || task.notes?.trim() || undefined,
    todos,
    weekly: existing?.weekly || task.weekly || undefined,
    spanSlots: existing ? spanSlotsForCell(existing) : undefined,
  })
}

export function addTaskToPlannerCells(
  timetable: PlannerTimetable,
  slots: ReadonlyArray<{ weekdayId: PlannerDayId; periodId: PlannerPeriodId }>,
  task: { title: string; notes?: string; weekly?: boolean }
): PlannerTimetable {
  return slots.reduce(
    (next, slot) => addTaskToPlannerCell(next, slot.weekdayId, slot.periodId, task),
    timetable
  )
}

export function resetPlannerWeek(
  timetable: PlannerTimetable,
  weekKey = plannerWeekKey()
): PlannerTimetable {
  const cells = timetable.cells.filter((cell) => cell.weekly)
  return normalizeTimetable({ cells, weekKey })
}

export function applyPlannerWeekRollover(
  timetable: PlannerTimetable,
  now = new Date()
): PlannerTimetable {
  const weekKey = plannerWeekKey(now)
  if (!timetable.weekKey) {
    return { ...timetable, weekKey }
  }
  if (timetable.weekKey === weekKey) return timetable
  return resetPlannerWeek(timetable, weekKey)
}

export function parsePlannerTimetableJson(raw: string): PlannerTimetable | null {
  try {
    const parsed = JSON.parse(raw) as PlannerTimetable
    return normalizeTimetable(parsed)
  } catch {
    return null
  }
}
