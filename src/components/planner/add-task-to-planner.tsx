"use client"

import { Button } from "@/components/ui/button"
import {
  PLANNER_PERIOD_SECTIONS,
  PLANNER_PERIODS,
  PLANNER_WEEKDAYS,
  PLANNER_WEEKEND_DAYS,
  PLANNER_WEEKEND_SLOTS,
  defaultPlannerSheet,
  isPlannerSlotAvailable,
  todayPlannerDayId,
  weekdayIdFromDate,
  weekendSlotsForDay,
  type PlannerDayId,
  type PlannerPeriodId,
  type PlannerSheet,
} from "@/domain/entities/planner"
import { addTaskToPlannerCells } from "@/domain/services/planner-timetable"
import { usePlannerTimetable } from "@/hooks/use-planner-timetable"
import { CalendarDays, Repeat } from "lucide-react"
import { useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { toast } from "sonner"

const WEEKEND_BANDS = [
  { id: "morning", title: "아침", from: 7 * 60, to: 12 * 60 },
  { id: "afternoon", title: "낮", from: 12 * 60, to: 17 * 60 },
  { id: "evening", title: "저녁", from: 17 * 60, to: 22 * 60 },
  { id: "night", title: "밤", from: 22 * 60, to: 25 * 60 + 1 },
] as const

const WEEKDAY_DAY_IDS = PLANNER_WEEKDAYS.map((day) => day.id)
const WEEKEND_DAY_IDS = PLANNER_WEEKEND_DAYS.map((day) => day.id)

function defaultDay(dueDate?: string, sheet: PlannerSheet = "weekday"): PlannerDayId {
  const fromDue = weekdayIdFromDate(dueDate ?? "")
  if (sheet === "weekend") {
    if (fromDue === "sat" || fromDue === "sun" || fromDue === "fri") return fromDue
    const today = todayPlannerDayId()
    if (today === "sat" || today === "sun" || today === "fri") return today
    return "sat"
  }
  if (fromDue && fromDue !== "sat" && fromDue !== "sun") return fromDue
  const today = todayPlannerDayId()
  if (today !== "sat" && today !== "sun") return today
  return "mon"
}

function firstPeriod(dayId: PlannerDayId, sheet: PlannerSheet): PlannerPeriodId {
  if (sheet === "weekend") {
    return weekendSlotsForDay(dayId)[0]?.id ?? "we-0700"
  }
  return PLANNER_PERIODS.find((period) => isPlannerSlotAvailable(dayId, period.id))?.id ?? "1"
}

function dayOrder(sheet: PlannerSheet): PlannerDayId[] {
  return sheet === "weekend" ? [...WEEKEND_DAY_IDS] : [...WEEKDAY_DAY_IDS]
}

function toggleId<T extends string>(list: T[], id: T): T[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id]
}

function dayLabel(dayId: PlannerDayId): string {
  if (dayId === "sat") return "토"
  if (dayId === "sun") return "일"
  return PLANNER_WEEKDAYS.find((day) => day.id === dayId)?.label ?? dayId
}

function periodLabel(periodId: PlannerPeriodId, sheet: PlannerSheet): string {
  if (sheet === "weekend") {
    return PLANNER_WEEKEND_SLOTS.find((slot) => slot.id === periodId)?.label ?? periodId
  }
  return PLANNER_PERIODS.find((item) => item.id === periodId)?.label ?? periodId
}

export function AddTaskToPlannerButton({
  title,
  notes,
  dueDate,
}: {
  title: string
  notes?: string
  dueDate?: string
}) {
  const { timetable, save } = usePlannerTimetable()
  const initialSheet = useMemo(() => {
    const fromDue = weekdayIdFromDate(dueDate ?? "")
    if (fromDue === "sat" || fromDue === "sun") return "weekend" as const
    return defaultPlannerSheet()
  }, [dueDate])
  const [open, setOpen] = useState(false)
  const [sheet, setSheet] = useState<PlannerSheet>(initialSheet)
  const [weekdayIds, setWeekdayIds] = useState<PlannerDayId[]>([
    defaultDay(dueDate, initialSheet),
  ])
  const [periodIds, setPeriodIds] = useState<PlannerPeriodId[]>([
    firstPeriod(defaultDay(dueDate, initialSheet), initialSheet),
  ])
  const [weekly, setWeekly] = useState(false)

  function applySheet(nextSheet: PlannerSheet, nextDay = defaultDay(dueDate, nextSheet)) {
    setSheet(nextSheet)
    setWeekdayIds([nextDay])
    setPeriodIds([firstPeriod(nextDay, nextSheet)])
  }

  function openPicker() {
    const nextSheet =
      weekdayIdFromDate(dueDate ?? "") === "sat" || weekdayIdFromDate(dueDate ?? "") === "sun"
        ? "weekend"
        : defaultPlannerSheet()
    const nextDay = defaultDay(dueDate, nextSheet)
    setSheet(nextSheet)
    setWeekdayIds([nextDay])
    setPeriodIds([firstPeriod(nextDay, nextSheet)])
    setWeekly(false)
    setOpen(true)
  }

  const selectedSlots = useMemo(() => {
    const days = dayOrder(sheet).filter((dayId) => weekdayIds.includes(dayId))
    const periods =
      sheet === "weekend"
        ? PLANNER_WEEKEND_SLOTS.map((slot) => slot.id).filter((id) => periodIds.includes(id))
        : PLANNER_PERIODS.map((period) => period.id).filter((id) => periodIds.includes(id))
    return days.flatMap((weekdayId) =>
      periods
        .filter((periodId) => isPlannerSlotAvailable(weekdayId, periodId))
        .map((periodId) => ({ weekdayId, periodId }))
    )
  }, [sheet, weekdayIds, periodIds])

  const weekendSlots = useMemo(() => {
    const days = weekdayIds.length ? weekdayIds : WEEKEND_DAY_IDS
    const seen = new Set<string>()
    return PLANNER_WEEKEND_SLOTS.filter((slot) => {
      if (!days.some((dayId) => isPlannerSlotAvailable(dayId, slot.id))) return false
      if (seen.has(slot.id)) return false
      seen.add(slot.id)
      return true
    })
  }, [weekdayIds])

  function confirm() {
    if (!weekdayIds.length || !periodIds.length) {
      toast.error("요일과 교시를 하나 이상 선택해 주세요.")
      return
    }
    if (!selectedSlots.length) {
      toast.error("선택한 요일에는 없는 교시입니다.")
      return
    }
    const next = addTaskToPlannerCells(timetable, selectedSlots, {
      title,
      notes,
      weekly,
    })
    if (save(next) === false) return
    const days = dayOrder(sheet)
      .filter((dayId) => weekdayIds.includes(dayId))
      .map((dayId) => dayLabel(dayId))
    const periods = (
      sheet === "weekend"
        ? PLANNER_WEEKEND_SLOTS.map((slot) => slot.id)
        : PLANNER_PERIODS.map((period) => period.id)
    )
      .filter((id) => periodIds.includes(id))
      .map((id) => periodLabel(id, sheet))
    const summary =
      selectedSlots.length === 1
        ? `${days[0]} ${periods[0]}`
        : `${days.join("·")} ${periods.join("·")}`
    toast.success(
      `${summary} 플래너에 ${weekly ? "매주 반복으로 " : ""}추가했습니다.`
    )
    setOpen(false)
  }

  return (
    <>
      <Button type="button" variant="outline" size="xs" onClick={openPicker}>
        <CalendarDays className="size-3.5" />
        플래너에 추가
      </Button>
      {open
        ? createPortal(
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
              <button
                type="button"
                className="absolute inset-0 bg-black/25"
                aria-label="닫기"
                onClick={() => setOpen(false)}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="add-to-planner-title"
                className="relative z-[121] max-h-[min(90vh,40rem)] w-full max-w-sm space-y-4 overflow-y-auto rounded-md border border-border bg-popover p-4 text-sm shadow-lg"
                onClick={(event) => event.stopPropagation()}
              >
                <div>
                  <h2 id="add-to-planner-title" className="text-base font-medium">
                    플래너에 추가
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">{title}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">구분</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      size="xs"
                      variant={sheet === "weekday" ? "default" : "outline"}
                      onClick={() => applySheet("weekday")}
                    >
                      평일
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant={sheet === "weekend" ? "default" : "outline"}
                      onClick={() => applySheet("weekend")}
                    >
                      주말
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">요일 · 여러 개 선택</p>
                  <div className="flex flex-wrap gap-1.5">
                    {sheet === "weekday"
                      ? PLANNER_WEEKDAYS.map((day) => (
                          <Button
                            key={day.id}
                            type="button"
                            size="xs"
                            variant={weekdayIds.includes(day.id) ? "default" : "outline"}
                            aria-pressed={weekdayIds.includes(day.id)}
                            onClick={() => setWeekdayIds((prev) => toggleId(prev, day.id))}
                          >
                            {day.label}
                          </Button>
                        ))
                      : PLANNER_WEEKEND_DAYS.map((day) => (
                          <Button
                            key={day.id}
                            type="button"
                            size="xs"
                            variant={weekdayIds.includes(day.id) ? "default" : "outline"}
                            aria-pressed={weekdayIds.includes(day.id)}
                            onClick={() => setWeekdayIds((prev) => toggleId(prev, day.id))}
                          >
                            {day.label}
                          </Button>
                        ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {sheet === "weekend" ? "시간 (30분) · 여러 개 선택" : "교시 · 여러 개 선택"}
                  </p>
                  {sheet === "weekday"
                    ? PLANNER_PERIOD_SECTIONS.map((section) => {
                        const days = weekdayIds.length ? weekdayIds : WEEKDAY_DAY_IDS
                        const periods = PLANNER_PERIODS.filter(
                          (period) =>
                            period.section === section.id &&
                            days.some((dayId) => isPlannerSlotAvailable(dayId, period.id))
                        )
                        if (!periods.length) return null
                        return (
                          <div key={section.id} className="space-y-1.5">
                            <p className="text-[11px] font-medium text-primary">{section.title}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {periods.map((period) => (
                                <Button
                                  key={period.id}
                                  type="button"
                                  size="xs"
                                  variant={periodIds.includes(period.id) ? "default" : "outline"}
                                  aria-pressed={periodIds.includes(period.id)}
                                  onClick={() =>
                                    setPeriodIds((prev) => toggleId(prev, period.id))
                                  }
                                >
                                  {period.label}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )
                      })
                    : WEEKEND_BANDS.map((band) => {
                        const slots = weekendSlots.filter(
                          (slot) => slot.sortMinutes >= band.from && slot.sortMinutes < band.to
                        )
                        if (!slots.length) return null
                        return (
                          <div key={band.id} className="space-y-1.5">
                            <p className="text-[11px] font-medium text-primary">{band.title}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {slots.map((slot) => (
                                <Button
                                  key={slot.id}
                                  type="button"
                                  size="xs"
                                  variant={periodIds.includes(slot.id) ? "default" : "outline"}
                                  aria-pressed={periodIds.includes(slot.id)}
                                  onClick={() =>
                                    setPeriodIds((prev) => toggleId(prev, slot.id))
                                  }
                                >
                                  {slot.label}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={weekly ? "default" : "outline"}
                  className="w-full"
                  aria-pressed={weekly}
                  onClick={() => setWeekly((value) => !value)}
                >
                  <Repeat className="size-3.5" />
                  매주 반복
                </Button>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                    취소
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={confirm}
                    disabled={!selectedSlots.length}
                  >
                    {selectedSlots.length > 1 ? `${selectedSlots.length}칸 추가` : "추가"}
                  </Button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}
