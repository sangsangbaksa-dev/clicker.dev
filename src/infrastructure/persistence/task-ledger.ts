import { readdir, unlink } from "node:fs/promises"
import path from "node:path"
import type { Room, Task } from "@/domain/entities/board"
import {
  dropAllLedgerTasks,
  dropLedgerTasks,
  emptyTaskLedger,
  ledgerFromRooms,
  mergeTaskLedgers,
  type TaskLedger,
} from "@/domain/services/task-ledger"
import { dataPath } from "@/infrastructure/persistence/data-dir"
import {
  deleteSharedBlob,
  listSharedBlobs,
  readJsonFile,
  readSharedBlobJson,
  readSharedLayers,
  rememberSnapshot,
  writeJsonFile,
  writeSharedBlobJson,
  writeSharedJson,
} from "@/infrastructure/persistence/shared-json-store"
import { runtimeDelete, runtimeGet, runtimeSet } from "@/infrastructure/persistence/runtime-json-store"
import bundledTasks from "../../../data/tasks.json"

const BLOB_KEY = "task-ledger"
const FILE_PATH = dataPath("tasks-live.json")
const FILE_DIR = dataPath("task-files")
const runtimeTaskKey = (code: string, id: string) => `task:${code}:${id}`
const blobTaskKey = (code: string, id: string) => `tasks/${code}/${id}`
const taskFile = (code: string, id: string) => path.join(FILE_DIR, code, `${id}.json`)

function asTask(value: unknown): Task | null {
  if (!value || typeof value !== "object") return null
  const row = value as Partial<Task>
  if (typeof row.id !== "string" || !row.id) return null
  if (typeof row.title !== "string" || !row.title) return null
  return {
    id: row.id,
    title: row.title,
    notes: String(row.notes ?? ""),
    dueDate: String(row.dueDate ?? ""),
    assigneeIds: Array.isArray(row.assigneeIds)
      ? row.assigneeIds.filter((id): id is string => typeof id === "string")
      : [],
    createdAt: typeof row.createdAt === "string" ? row.createdAt : "",
    comments: Array.isArray(row.comments) ? row.comments : [],
  }
}

function asLedger(value: unknown): TaskLedger | null {
  if (!value || typeof value !== "object") return null
  const row = value as { rooms?: unknown; droppedIds?: unknown; updatedAt?: unknown }
  if (!row.rooms || typeof row.rooms !== "object") return null
  const rooms: TaskLedger["rooms"] = {}
  for (const [code, entry] of Object.entries(row.rooms as Record<string, unknown>)) {
    if (!code || !entry || typeof entry !== "object") continue
    const rawTasks = (entry as { tasks?: unknown }).tasks
    if (!rawTasks || typeof rawTasks !== "object") continue
    const tasks: Record<string, Task> = {}
    for (const item of Object.values(rawTasks as Record<string, unknown>)) {
      const task = asTask(item)
      if (task) tasks[task.id] = task
    }
    if (Object.keys(tasks).length > 0) rooms[code] = { tasks }
  }
  const droppedIds: Record<string, string[]> = {}
  if (row.droppedIds && typeof row.droppedIds === "object" && !Array.isArray(row.droppedIds)) {
    for (const [code, ids] of Object.entries(row.droppedIds as Record<string, unknown>)) {
      if (!code || !Array.isArray(ids)) continue
      const next = ids.filter((id): id is string => typeof id === "string" && Boolean(id))
      if (next.length > 0) droppedIds[code] = next
    }
  }
  return {
    rooms,
    droppedIds,
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : "",
  }
}

function bundledLedger(): TaskLedger {
  return asLedger(bundledTasks) ?? emptyTaskLedger()
}

async function listLocalTaskFiles(): Promise<TaskLedger> {
  const rooms: TaskLedger["rooms"] = {}
  try {
    const codes = await readdir(FILE_DIR)
    await Promise.all(
      codes.map(async (code) => {
        try {
          const names = await readdir(path.join(FILE_DIR, code))
          const tasks: Record<string, Task> = {}
          await Promise.all(
            names.map(async (name) => {
              if (!name.endsWith(".json")) return
              const task = asTask(await readJsonFile(path.join(FILE_DIR, code, name)))
              if (task) tasks[task.id] = task
            })
          )
          if (Object.keys(tasks).length > 0) rooms[code] = { tasks }
        } catch {
          // missing class folder
        }
      })
    )
  } catch {
    return emptyTaskLedger()
  }
  return { rooms, droppedIds: {}, updatedAt: "" }
}

async function hydrateLedgerTasks(ledger: TaskLedger): Promise<TaskLedger> {
  const extra: TaskLedger["rooms"] = {}
  const blobs = await listSharedBlobs("hsms-md/tasks/")
  const pairs = new Map<string, Set<string>>()
  for (const [code, entry] of Object.entries(ledger.rooms)) {
    pairs.set(code, new Set(Object.keys(entry.tasks)))
  }
  for (const blob of blobs) {
    const parsed = taskIdFromBlobPath(blob.pathname)
    if (!parsed) continue
    const ids = pairs.get(parsed.code) ?? new Set<string>()
    ids.add(parsed.id)
    pairs.set(parsed.code, ids)
  }
  await Promise.all(
    [...pairs.entries()].flatMap(([code, ids]) =>
      [...ids].map(async (id) => {
        if (ledger.rooms[code]?.tasks[id]) return
        if ((ledger.droppedIds[code] ?? []).includes(id)) return
        const [file, blob, cache] = await Promise.all([
          readJsonFile<Task>(taskFile(code, id)),
          readSharedBlobJson<Task>(blobTaskKey(code, id)),
          runtimeGet<Task>(runtimeTaskKey(code, id)),
        ])
        const task = asTask(file) ?? asTask(blob.value) ?? asTask(cache)
        if (!task) return
        extra[code] = extra[code] ?? { tasks: {} }
        extra[code].tasks[task.id] = task
      })
    )
  )
  return mergeTaskLedgers([ledger, { rooms: extra, droppedIds: ledger.droppedIds, updatedAt: "" }])
}

export async function loadTaskLedger(): Promise<TaskLedger> {
  const layers = await readSharedLayers<TaskLedger>(BLOB_KEY, () =>
    readJsonFile<TaskLedger>(FILE_PATH)
  )
  const localFiles = await listLocalTaskFiles()
  let ledger = mergeTaskLedgers([
    bundledLedger(),
    asLedger(layers.file),
    asLedger(layers.blob),
    asLedger(layers.cache),
    asLedger(layers.snapshot),
    localFiles,
  ])
  if (Object.keys(ledger.rooms).length <= 2) {
    ledger = await hydrateLedgerTasks(ledger)
  }
  rememberSnapshot(BLOB_KEY, ledger)
  return ledger
}

async function writeLedgerFiles(ledger: TaskLedger, dropped: Array<{ code: string; id: string }>) {
  await writeSharedJson(BLOB_KEY, ledger, () => writeJsonFile(FILE_PATH, ledger))
  await Promise.all([
    ...Object.entries(ledger.rooms).flatMap(([code, entry]) =>
      Object.values(entry.tasks).map(async (task) => {
        await Promise.all([
          writeJsonFile(taskFile(code, task.id), task),
          writeSharedBlobJson(blobTaskKey(code, task.id), task),
          runtimeSet(runtimeTaskKey(code, task.id), task),
        ])
      })
    ),
    ...dropped.map(async ({ code, id }) => {
      await Promise.all([
        unlink(taskFile(code, id)).catch(() => undefined),
        deleteSharedBlob(blobTaskKey(code, id)),
        runtimeDelete(runtimeTaskKey(code, id)),
      ])
    }),
  ])
}

export async function persistRoomTasks(
  code: string,
  tasks: Task[],
  droppedIds: Iterable<string> = []
): Promise<TaskLedger> {
  const dropped = [...droppedIds].filter(Boolean)
  const current = dropLedgerTasks(await loadTaskLedger(), code, dropped)
  const incoming = ledgerFromRooms(
    { [code]: { code, tasks } as Room },
    new Date().toISOString()
  )
  const next = mergeTaskLedgers([current, incoming])
  next.updatedAt = incoming.updatedAt
  rememberSnapshot(BLOB_KEY, next)
  await writeLedgerFiles(
    next,
    dropped.map((id) => ({ code, id }))
  )
  return next
}

export async function persistTaskLedgerFromRooms(
  rooms: Record<string, Room>
): Promise<TaskLedger> {
  const current = await loadTaskLedger()
  const incoming = ledgerFromRooms(rooms, new Date().toISOString())
  const next = mergeTaskLedgers([current, incoming])
  next.updatedAt = incoming.updatedAt
  rememberSnapshot(BLOB_KEY, next)
  await writeLedgerFiles(next, [])
  return next
}

function taskIdFromBlobPath(pathname: string): { code: string; id: string } | null {
  const match = pathname.match(/\/tasks\/([A-Z0-9]+)\/(task_[A-Za-z0-9-]+)\.json$/)
  if (!match) return null
  return { code: match[1], id: match[2] }
}

export async function clearPersistedTaskLedger(): Promise<TaskLedger> {
  const current = await loadTaskLedger()
  const extraDropped: Array<{ code: string; id: string }> = []
  const blobs = await listSharedBlobs("hsms-md/tasks/")
  for (const blob of blobs) {
    const parsed = taskIdFromBlobPath(blob.pathname)
    if (parsed) extraDropped.push(parsed)
  }
  let ledger = current
  for (const { code, id } of extraDropped) {
    ledger = dropLedgerTasks(ledger, code, [id])
  }
  const { ledger: emptied, dropped } = dropAllLedgerTasks(ledger)
  const seen = new Set(dropped.map((item) => `${item.code}:${item.id}`))
  const allDropped = [...dropped]
  for (const item of extraDropped) {
    const key = `${item.code}:${item.id}`
    if (seen.has(key)) continue
    seen.add(key)
    allDropped.push(item)
  }
  const next: TaskLedger = {
    ...emptied,
    updatedAt: new Date().toISOString(),
  }
  rememberSnapshot(BLOB_KEY, next)
  await writeLedgerFiles(next, allDropped)
  return next
}
