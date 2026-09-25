export type PlannerSheet = "weekday" | "weekend"

export const PLANNER_WEEKDAYS = [
  { id: "mon", label: "월" },
  { id: "tue", label: "화" },
  { id: "wed", label: "수" },
  { id: "thu", label: "목" },
  { id: "fri", label: "금" },
] as const

export const PLANNER_WEEKEND_DAYS = [
  { id: "fri", label: "금" },
  { id: "sat", label: "토" },
  { id: "sun", label: "일" },
] as const

export type PlannerWeekdayId = (typeof PLANNER_WEEKDAYS)[number]["id"]
export type PlannerDayId = PlannerWeekdayId | "sat" | "sun"

export const PLANNER_DAY_LABELS: Record<PlannerDayId, string> = {
  mon: "월",
  tue: "화",
  wed: "수",
  thu: "목",
  fri: "금",
  sat: "토",
  sun: "일",
}

export type PlannerPeriodSection = "regular" | "night" | "dorm" | "weekend"

export type PlannerPeriod = {
  id: string
  label: string
  time: string
  section: PlannerPeriodSection
}

/** 정규 8교시 + 야간자기주도학습 3교시 + 기숙사 자습 2교시 (월~목). 금요일은 1~7교시만. */
export const PLANNER_PERIODS = [
  { id: "1", label: "1교시", time: "08:40–09:30", section: "regular" },
  { id: "2", label: "2교시", time: "09:40–10:30", section: "regular" },
  { id: "3", label: "3교시", time: "10:40–11:30", section: "regular" },
  { id: "4", label: "4교시", time: "11:40–12:30", section: "regular" },
  { id: "5", label: "5교시", time: "13:30–14:20", section: "regular" },
  { id: "6", label: "6교시", time: "14:30–15:20", section: "regular" },
  { id: "7", label: "7교시", time: "15:30–16:20", section: "regular" },
  { id: "8", label: "8교시", time: "16:30–17:20", section: "regular" },
  { id: "night1", label: "야자 1", time: "19:00–19:50", section: "night" },
  { id: "night2", label: "야자 2", time: "20:00–20:50", section: "night" },
  { id: "night3", label: "야자 3", time: "21:00–21:50", section: "night" },
  { id: "dorm1", label: "기숙 1", time: "22:00–22:50", section: "dorm" },
  { id: "dorm2", label: "기숙 2", time: "23:00–23:50", section: "dorm" },
] as const satisfies readonly PlannerPeriod[]

export type PlannerWeekdayPeriodId = (typeof PLANNER_PERIODS)[number]["id"]

export const PLANNER_PERIOD_SECTIONS: {
  id: Exclude<PlannerPeriodSection, "weekend">
  title: string
  hint: string
}[] = [
  { id: "regular", title: "정규 수업", hint: "월~목 1~8교시 · 금 1~7교시" },
  { id: "night", title: "야간자기주도학습", hint: "월~목 3교시" },
  { id: "dorm", title: "기숙사 자습", hint: "월~목 2교시" },
]

const DAY_MINUTES = 24 * 60
/** 주말 격자: 07:00부터 다음날 01:00까지 30분 칸 */
export const WEEKEND_SLOT_START_MINUTES = 7 * 60
export const WEEKEND_SLOT_END_MINUTES = 25 * 60
export const WEEKEND_SLOT_STEP_MINUTES = 30
/** 금요일 7교시 종료(16:20) 이후부터 주말 칸 */
export const FRIDAY_WEEKEND_START_MINUTES = 16 * 60 + 30

function pad2(value: number): string {
  return String(value).padStart(2, "0")
}

export function formatMinutesAsTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
  const hours = Math.floor(normalized / 60)
  const minutes = normalized % 60
  return `${pad2(hours)}:${pad2(minutes)}`
}

export function weekendSlotIdFromMinutes(totalMinutes: number): string {
  return `we-${formatMinutesAsTime(totalMinutes).replace(":", "")}`
}

export type PlannerWeekendSlot = PlannerPeriod & {
  id: string
  sortMinutes: number
}

function buildWeekendSlots(): PlannerWeekendSlot[] {
  const slots: PlannerWeekendSlot[] = []
  for (
    let minutes = WEEKEND_SLOT_START_MINUTES;
    minutes <= WEEKEND_SLOT_END_MINUTES;
    minutes += WEEKEND_SLOT_STEP_MINUTES
  ) {
    const start = formatMinutesAsTime(minutes)
    const end = formatMinutesAsTime(minutes + WEEKEND_SLOT_STEP_MINUTES)
    slots.push({
      id: weekendSlotIdFromMinutes(minutes),
      label: start,
      time: `${start}–${end}`,
      section: "weekend",
      sortMinutes: minutes,
    })
  }
  return slots
}

export const PLANNER_WEEKEND_SLOTS: readonly PlannerWeekendSlot[] = buildWeekendSlots()

export type PlannerPeriodId = PlannerWeekdayPeriodId | string

export function isWeekendSlotId(periodId: string): boolean {
  return periodId.startsWith("we-")
}

export function plannerWeekendSlotById(periodId: string): PlannerWeekendSlot | undefined {
  return PLANNER_WEEKEND_SLOTS.find((slot) => slot.id === periodId)
}

export function plannerPeriodById(periodId: string): PlannerPeriod | undefined {
  return (
    PLANNER_PERIODS.find((period) => period.id === periodId) ??
    plannerWeekendSlotById(periodId)
  )
}

export function isRegularPeriod(periodId: string): boolean {
  return plannerPeriodById(periodId)?.section === "regular"
}

export function weekendSlotsForDay(dayId: PlannerDayId): PlannerWeekendSlot[] {
  if (dayId === "sat" || dayId === "sun") return [...PLANNER_WEEKEND_SLOTS]
  if (dayId === "fri") {
    return PLANNER_WEEKEND_SLOTS.filter(
      (slot) => slot.sortMinutes >= FRIDAY_WEEKEND_START_MINUTES
    )
  }
  return []
}

export function isPlannerSlotAvailable(dayId: PlannerDayId, periodId: string): boolean {
  if (isWeekendSlotId(periodId)) {
    return weekendSlotsForDay(dayId).some((slot) => slot.id === periodId)
  }
  const period = plannerPeriodById(periodId)
  if (!period || period.section === "weekend") return false
  if (dayId === "sat" || dayId === "sun") return false
  if (dayId !== "fri") return true
  return period.section === "regular" && period.id !== "8"
}

export function defaultPlannerSheet(now = new Date()): PlannerSheet {
  const day = now.getDay()
  if (day === 0 || day === 6) return "weekend"
  if (day === 5) {
    const minutes = now.getHours() * 60 + now.getMinutes()
    if (minutes >= 16 * 60 + 20) return "weekend"
  }
  return "weekday"
}

export const PLANNER_COLORS = [
  { id: "teal", label: "틸", cell: "bg-[#2F6F7E]/18 border-[#2F6F7E]/35 text-[#1f4f5c]" },
  { id: "green", label: "초록", cell: "bg-[#3f6f5a]/18 border-[#3f6f5a]/35 text-[#2d4f3f]" },
  { id: "amber", label: "노랑", cell: "bg-amber-500/15 border-amber-500/35 text-amber-950" },
  { id: "rose", label: "분홍", cell: "bg-rose-500/15 border-rose-500/35 text-rose-950" },
  { id: "violet", label: "보라", cell: "bg-violet-500/15 border-violet-500/35 text-violet-950" },
  { id: "sky", label: "하늘", cell: "bg-sky-500/15 border-sky-500/35 text-sky-950" },
  { id: "orange", label: "주황", cell: "bg-orange-500/15 border-orange-500/35 text-orange-950" },
  { id: "slate", label: "회색", cell: "bg-slate-500/12 border-slate-500/30 text-slate-800" },
] as const

export type PlannerColorId = (typeof PLANNER_COLORS)[number]["id"]

export const PLANNER_SUBJECT_SUGGESTIONS = [
  "국어",
  "수학",
  "영어",
  "과학",
  "사회",
  "도덕",
  "체육유도",
  "음악",
  "미술",
  "기술가정",
  "한문",
  "기타",
] as const

export type PlannerTodo = {
  text: string
  weekly?: boolean
}

export function plannerTodoText(todo: PlannerTodo | string): string {
  return typeof todo === "string" ? todo : todo.text
}

export function todoHasText(todo: PlannerTodo | string): boolean {
  return Boolean(plannerTodoText(todo).trim())
}

/** 시간표 한 칸. 주말은 periodId가 시작 슬롯, spanSlots가 30분 칸 수. */
export type PlannerCell = {
  weekdayId: PlannerDayId
  periodId: PlannerPeriodId
  label: string
  colorId?: PlannerColorId
  room?: string
  memo?: string
  todos?: PlannerTodo[]
  /** 켜면 주가 바뀌어도 과목·할 일·메모가 남습니다. */
  weekly?: boolean
  /** 주말 30분 칸을 몇 개 차지하는지. 없으면 1칸. */
  spanSlots?: number
}

export function cellHasContent(
  cell: Pick<PlannerCell, "label" | "memo" | "todos">
): boolean {
  return Boolean(
    cell.label.trim() ||
      cell.memo?.trim() ||
      cell.todos?.some((todo) => todoHasText(todo))
  )
}

export function plannerColorClass(colorId?: PlannerColorId): string {
  const found = PLANNER_COLORS.find((item) => item.id === colorId)
  return found?.cell ?? PLANNER_COLORS[0].cell
}

const DAY_BY_JS_DAY: Record<number, PlannerDayId> = {
  0: "sun",
  1: "mon",
  2: "tue",
  3: "wed",
  4: "thu",
  5: "fri",
  6: "sat",
}

export function todayPlannerDayId(now = new Date()): PlannerDayId {
  return DAY_BY_JS_DAY[now.getDay()] ?? "mon"
}

/** 오늘 평일 열 id. 토·일이면 null */
export function todayWeekdayId(now = new Date()): PlannerWeekdayId | null {
  const day = todayPlannerDayId(now)
  if (day === "sat" || day === "sun") return null
  return day
}

export function weekdayIdFromDate(dueDate: string): PlannerDayId | null {
  const ms = new Date(`${dueDate}T00:00:00`).getTime()
  if (!Number.isFinite(ms)) return null
  return DAY_BY_JS_DAY[new Date(ms).getDay()] ?? null
}

export type PlannerTimetable = {
  cells: PlannerCell[]
  weekKey?: string
}

export function cellKey(weekdayId: PlannerDayId, periodId: PlannerPeriodId): string {
  return `${weekdayId}:${periodId}`
}

export function buildCellMap(cells: PlannerCell[]): Map<string, PlannerCell> {
  const map = new Map<string, PlannerCell>()
  for (const cell of cells) {
    if (cellHasContent(cell)) {
      map.set(cellKey(cell.weekdayId, cell.periodId), cell)
    }
  }
  return map
}

function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** 일요일 12:59에 새 주가 시작됩니다. */
const WEEK_ROLLOVER_DAY = 0
const WEEK_ROLLOVER_MINUTES = 12 * 60 + 59

export function plannerWeekKey(now = new Date()): string {
  const current = new Date(now)
  const day = current.getDay()
  const minutes = current.getHours() * 60 + current.getMinutes()
  const weekStart = new Date(current)
  weekStart.setHours(0, 0, 0, 0)
  if (day === WEEK_ROLLOVER_DAY && minutes < WEEK_ROLLOVER_MINUTES) {
    weekStart.setDate(weekStart.getDate() - 7)
  } else if (day !== WEEK_ROLLOVER_DAY) {
    weekStart.setDate(weekStart.getDate() - day)
  }
  return formatLocalDate(weekStart)
}
