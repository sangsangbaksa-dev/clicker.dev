"use client"

import {
  applyPlannerWeekRollover,
  normalizeTimetable,
  parsePlannerTimetableJson,
  resetPlannerWeek,
} from "@/domain/services/planner-timetable"
import { plannerWeekKey, type PlannerTimetable } from "@/domain/entities/planner"
import { findDisallowedSnippet } from "@/domain/services/content-moderation"
import { refreshAuthSession } from "@/hooks/use-auth"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

const STORAGE_KEY = "hsms-planner-timetable-v1"

function persist(timetable: PlannerTimetable) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(timetable))
}

function readStored(): PlannerTimetable {
  if (typeof window === "undefined") return { cells: [] }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { cells: [] }
    return parsePlannerTimetableJson(raw) ?? { cells: [] }
  } catch {
    return { cells: [] }
  }
}

function collectTexts(timetable: PlannerTimetable): string[] {
  return timetable.cells.flatMap((cell) => [
    cell.label,
    cell.memo ?? "",
    ...(cell.todos ?? []).map((todo) => todo.text),
  ])
}

export function usePlannerTimetable() {
  const [timetable, setTimetable] = useState<PlannerTimetable>({ cells: [] })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // localStorage is only readable after hydration, so the first real value lands here.
    const stored = applyPlannerWeekRollover(readStored())
    persist(stored)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimetable(stored)
    setReady(true)

    const tick = () => {
      setTimetable((prev) => {
        const next = applyPlannerWeekRollover(prev)
        if (next === prev) return prev
        persist(next)
        return next
      })
    }
    const id = window.setInterval(tick, 60_000)
    return () => window.clearInterval(id)
  }, [])

  const save = useCallback((next: PlannerTimetable) => {
    const normalized = normalizeTimetable({
      ...next,
      weekKey: next.weekKey ?? plannerWeekKey(),
    })
    if (findDisallowedSnippet(collectTexts(normalized))) {
      toast.error("부적절한 표현이 감지되어 해당 내용은 저장되지 않았습니다.")
      void fetch("/api/auth/content-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ texts: collectTexts(normalized) }),
      }).then(async (response) => {
        if (response.status === 422) await refreshAuthSession()
      })
      return false
    }
    setTimetable(normalized)
    persist(normalized)
    return true
  }, [])

  const refreshWeek = useCallback(() => {
    const next = resetPlannerWeek(timetable)
    return save(next)
  }, [save, timetable])

  const exportJson = useCallback(() => {
    return JSON.stringify(timetable, null, 2)
  }, [timetable])

  const importJson = useCallback(
    (raw: string) => {
      const parsed = parsePlannerTimetableJson(raw)
      if (!parsed) return false
      return save(applyPlannerWeekRollover(parsed)) !== false
    },
    [save]
  )

  return { timetable, save, ready, exportJson, importJson, refreshWeek }
}
