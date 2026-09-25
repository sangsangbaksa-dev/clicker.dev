import type { Room, Task } from "@/domain/entities/board"

export type RoomTaskMap = Record<string, Task>

export type TaskLedger = {
  rooms: Record<string, { tasks: RoomTaskMap }>
  droppedIds: Record<string, string[]>
  updatedAt: string
}

export function emptyTaskLedger(updatedAt = ""): TaskLedger {
  return { rooms: {}, droppedIds: {}, updatedAt }
}

export function preferTask(a: Task, b: Task): Task {
  const aComments = a.comments?.length ?? 0
  const bComments = b.comments?.length ?? 0
  if (aComments !== bComments) return bComments > aComments ? b : a
  const aNotes = String(a.notes ?? "").length
  const bNotes = String(b.notes ?? "").length
  if (aNotes !== bNotes) return bNotes > aNotes ? b : a
  return b.createdAt >= a.createdAt ? b : a
}

function mergeDroppedIdMap(
  maps: Array<Record<string, string[]> | null | undefined>
): Record<string, string[]> {
  const byCode = new Map<string, Set<string>>()
  for (const map of maps) {
    if (!map) continue
    for (const [code, ids] of Object.entries(map)) {
      if (!code) continue
      const set = byCode.get(code) ?? new Set<string>()
      for (const id of ids ?? []) {
        if (id) set.add(id)
      }
      if (set.size > 0) byCode.set(code, set)
    }
  }
  return Object.fromEntries(
    [...byCode.entries()].map(([code, ids]) => [code, [...ids].sort()])
  )
}

export function droppedIdsForRoom(
  ledger: TaskLedger | null | undefined,
  code: string
): string[] {
  return ledger?.droppedIds?.[code] ?? []
}

export function mergeTaskLists(
  lists: Array<Task[] | null | undefined>,
  droppedIds: Iterable<string> = []
): Task[] {
  const dropped = new Set([...droppedIds].filter(Boolean))
  const byId = new Map<string, Task>()
  for (const list of lists) {
    for (const task of list ?? []) {
      if (!task?.id || dropped.has(task.id)) continue
      const current = byId.get(task.id)
      byId.set(task.id, current ? preferTask(current, task) : task)
    }
  }
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export function mergeTaskLedgers(
  ledgers: Array<TaskLedger | null | undefined>
): TaskLedger {
  const droppedIds = mergeDroppedIdMap(ledgers.map((ledger) => ledger?.droppedIds))
  const rooms: Record<string, { tasks: RoomTaskMap }> = {}
  let updatedAt = ""
  for (const ledger of ledgers) {
    if (!ledger) continue
    if (ledger.updatedAt > updatedAt) updatedAt = ledger.updatedAt
    for (const [code, entry] of Object.entries(ledger.rooms ?? {})) {
      if (!code) continue
      const dropped = new Set(droppedIds[code] ?? [])
      const current = rooms[code]?.tasks ?? {}
      const next: RoomTaskMap = { ...current }
      for (const id of dropped) delete next[id]
      for (const task of Object.values(entry.tasks ?? {})) {
        if (!task?.id || dropped.has(task.id)) continue
        next[task.id] = next[task.id] ? preferTask(next[task.id], task) : task
      }
      if (Object.keys(next).length === 0) delete rooms[code]
      else rooms[code] = { tasks: next }
    }
  }
  return { rooms, droppedIds, updatedAt }
}

/** Explicit deletes only. An empty board must not wipe the ledger. */
export function dropLedgerTasks(
  ledger: TaskLedger,
  code: string,
  droppedIds: Iterable<string>
): TaskLedger {
  const extra = [...droppedIds].filter(Boolean)
  if (!code || extra.length === 0) return ledger
  const current = ledger.rooms[code]
  const tasks = { ...(current?.tasks ?? {}) }
  for (const id of extra) delete tasks[id]
  const rooms = { ...ledger.rooms }
  if (Object.keys(tasks).length === 0) delete rooms[code]
  else rooms[code] = { tasks }
  return {
    rooms,
    droppedIds: mergeDroppedIdMap([ledger.droppedIds, { [code]: extra }]),
    updatedAt: ledger.updatedAt,
  }
}

export function dropAllLedgerTasks(ledger: TaskLedger): {
  ledger: TaskLedger
  dropped: Array<{ code: string; id: string }>
} {
  const dropped: Array<{ code: string; id: string }> = []
  let next = ledger
  for (const [code, entry] of Object.entries(ledger.rooms)) {
    const ids = Object.keys(entry.tasks ?? {})
    for (const id of ids) dropped.push({ code, id })
    next = dropLedgerTasks(next, code, ids)
  }
  return { ledger: next, dropped }
}

export function ledgerFromRooms(
  rooms: Record<string, Room>,
  updatedAt: string,
  droppedIds: Record<string, string[]> = {}
): TaskLedger {
  const next: TaskLedger = { rooms: {}, droppedIds: { ...droppedIds }, updatedAt }
  for (const room of Object.values(rooms)) {
    if (!room?.code) continue
    const dropped = new Set(droppedIds[room.code] ?? [])
    const tasks: RoomTaskMap = {}
    for (const task of room.tasks ?? []) {
      if (!task?.id || dropped.has(task.id)) continue
      tasks[task.id] = task
    }
    if (Object.keys(tasks).length === 0) continue
    next.rooms[room.code] = { tasks }
  }
  return next
}

export function droppedTaskIds(previous: Task[], incoming: Task[]): string[] {
  const nextIds = new Set(incoming.map((task) => task.id).filter(Boolean))
  return previous.map((task) => task.id).filter((id) => Boolean(id) && !nextIds.has(id))
}

export function reviveRoomFromLedger(
  room: Room,
  ledger: TaskLedger,
  droppedIds: Iterable<string> = []
): Room {
  const stored = Object.values(ledger.rooms[room.code]?.tasks ?? {})
  const dropped = [...(ledger.droppedIds?.[room.code] ?? []), ...droppedIds]
  return {
    ...room,
    tasks: mergeTaskLists([room.tasks, stored], dropped),
  }
}

export function applyLedgerToRooms(
  rooms: Record<string, Room>,
  ledger: TaskLedger
): Record<string, Room> {
  const next = { ...rooms }
  for (const [code, room] of Object.entries(next)) {
    next[code] = reviveRoomFromLedger(room, ledger)
  }
  return next
}

export function ledgerTaskCount(ledger: TaskLedger | null | undefined): number {
  if (!ledger) return 0
  let count = 0
  for (const entry of Object.values(ledger.rooms)) {
    count += Object.keys(entry.tasks ?? {}).length
  }
  return count
}

export function withClearedTasks<T extends { tasks?: Task[] }>(room: T): T {
  return { ...room, tasks: [] }
}
