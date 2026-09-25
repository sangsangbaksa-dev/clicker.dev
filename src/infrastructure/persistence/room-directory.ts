import { readdir } from "node:fs/promises"
import path from "node:path"
import type { Room } from "@/domain/entities/board"
import { CLASSES, classFromCode, createClassRoom } from "@/shared/classes"
import { dataPath } from "@/infrastructure/persistence/data-dir"
import {
  emptyRoomDirectory,
  keepKnownRooms,
  mergeRoomDirectories,
  type RoomDirectory,
} from "@/infrastructure/persistence/shared-merge"
import {
  peekSnapshot,
  readJsonFile,
  readSharedBlobJson,
  readSharedLayers,
  rememberSnapshot,
  writeBlobBackup,
  writeJsonFile,
  writeSharedBlobJson,
  writeSharedJson,
} from "@/infrastructure/persistence/shared-json-store"
import { SharedStoreUnavailableError } from "@/infrastructure/persistence/shared-store-error"
import { runtimeGet, runtimeSet } from "@/infrastructure/persistence/runtime-json-store"
import {
  applyLedgerToRooms,
  droppedTaskIds,
  reviveRoomFromLedger,
} from "@/domain/services/task-ledger"
import {
  loadTaskLedger,
  persistRoomTasks,
  persistTaskLedgerFromRooms,
} from "@/infrastructure/persistence/task-ledger"

const DIRECTORY_KEY = "room-directory"
const FILE_DIR = dataPath("rooms")
const DIRECTORY_FILE = path.join(FILE_DIR, "directory.json")
const NETLIFY_STORE = "sohaengbang-rooms"
const runtimeRoomKey = (code: string) => `room:${code}`

const DIRECTORY_TTL_MS = 8_000
const FRESH_COALESCE_MS = 400

type CachedDirectory = {
  loadedAt: number
  dir: RoomDirectory
  unreliable: boolean
  confirmedEmpty: boolean
}

let directoryCache: CachedDirectory | null = null
let directoryInflight: Promise<{
  dir: RoomDirectory
  unreliable: boolean
  confirmedEmpty: boolean
}> | null = null

function shouldUseNetlifyBlobs(): boolean {
  return (
    process.env.NETLIFY === "true" ||
    Boolean(process.env.NETLIFY_BLOBS_CONTEXT) ||
    Boolean(process.env.BLOBS_CONTEXT)
  )
}

async function netlifyStore() {
  const { getStore } = await import("@netlify/blobs")
  return getStore(NETLIFY_STORE)
}

async function readAllRoomFiles(): Promise<RoomDirectory> {
  const stored = await readJsonFile<RoomDirectory>(DIRECTORY_FILE)
  if (stored?.rooms && Object.keys(stored.rooms).length > 0) {
    return mergeRoomDirectories([stored])
  }
  const rooms: Record<string, Room> = {}
  try {
    const files = await readdir(FILE_DIR)
    await Promise.all(
      files.map(async (name) => {
        if (!name.endsWith(".json") || name === "directory.json") return
        const room = await readJsonFile<Room>(path.join(FILE_DIR, name))
        if (room?.code) rooms[room.code] = room
      })
    )
  } catch {
    await Promise.all(
      CLASSES.map(async (info) => {
        const room = await readJsonFile<Room>(path.join(FILE_DIR, `${info.code}.json`))
        if (room?.code) rooms[room.code] = room
      })
    )
  }
  return mergeRoomDirectories([{ rooms, updatedAt: stored?.updatedAt ?? "" }])
}

async function readDirectoryFromNetlify(): Promise<RoomDirectory | null> {
  if (!shouldUseNetlifyBlobs()) return null
  try {
    const store = await netlifyStore()
    const stored = (await store.get(DIRECTORY_KEY, { type: "json" })) as RoomDirectory | null
    const rooms: Record<string, Room> = { ...(stored?.rooms ?? {}) }
    await Promise.all(
      CLASSES.map(async (info) => {
        const value = await store.get(info.code, { type: "json" })
        if (value) rooms[info.code] = value as Room
      })
    )
    return mergeRoomDirectories([stored, { rooms, updatedAt: stored?.updatedAt ?? "" }])
  } catch {
    return null
  }
}

async function writeDirectoryToNetlify(dir: RoomDirectory): Promise<void> {
  if (!shouldUseNetlifyBlobs()) return
  try {
    const store = await netlifyStore()
    await store.setJSON(DIRECTORY_KEY, dir)
    await Promise.all(
      Object.values(dir.rooms).map((room) => store.setJSON(room.code, room))
    )
  } catch {
    // optional
  }
}

function blobRoomKey(code: string): string {
  return `rooms/${code}`
}

async function hydrateDurableRooms(dir: RoomDirectory): Promise<RoomDirectory> {
  const extras: Record<string, Room> = {}
  const codes = new Set([...Object.keys(dir.rooms), ...CLASSES.map((info) => info.code)])
  await Promise.all(
    [...codes].map(async (code) => {
      const [file, blob, cached] = await Promise.all([
        readJsonFile<Room>(path.join(FILE_DIR, `${code}.json`)),
        readSharedBlobJson<Room>(blobRoomKey(code)),
        runtimeGet<Room>(runtimeRoomKey(code)),
      ])
      const layers = [file, blob.value, cached].filter(
        (room): room is Room => Boolean(room?.code)
      )
      if (layers.length === 0) return
      const merged = mergeRoomDirectories([
        { rooms: Object.fromEntries(layers.map((room) => [room.code, room])), updatedAt: "" },
      ])
      const room = merged.rooms[code]
      if (room?.code) extras[room.code] = room
    })
  )
  return mergeRoomDirectories([dir, { rooms: extras, updatedAt: "" }])
}

async function persistDurableRooms(dir: RoomDirectory): Promise<void> {
  const stamp = dir.updatedAt.replace(/[:.]/g, "-") || "latest"
  await Promise.all([
    ...Object.values(dir.rooms).map((room) =>
      Promise.all([
        runtimeSet(runtimeRoomKey(room.code), room),
        writeSharedBlobJson(blobRoomKey(room.code), room),
      ])
    ),
    writeDirectoryToNetlify(dir),
    writeBlobBackup(`backups/room-directory/${stamp}`, dir),
  ])
}

export function invalidateRoomDirectory(): void {
  directoryCache = null
}

export async function loadRoomDirectory(options?: {
  fresh?: boolean
}): Promise<{
  dir: RoomDirectory
  unreliable: boolean
  confirmedEmpty: boolean
}> {
  if (
    options?.fresh &&
    directoryCache &&
    !directoryCache.unreliable &&
    Date.now() - directoryCache.loadedAt < FRESH_COALESCE_MS
  ) {
    return {
      dir: directoryCache.dir,
      unreliable: directoryCache.unreliable,
      confirmedEmpty: directoryCache.confirmedEmpty,
    }
  }
  if (
    !options?.fresh &&
    directoryCache &&
    Date.now() - directoryCache.loadedAt < DIRECTORY_TTL_MS
  ) {
    return {
      dir: directoryCache.dir,
      unreliable: directoryCache.unreliable,
      confirmedEmpty: directoryCache.confirmedEmpty,
    }
  }
  if (!options?.fresh && directoryInflight) return directoryInflight

  directoryInflight = (async () => {
    const layers = await readSharedLayers<RoomDirectory>(DIRECTORY_KEY, readAllRoomFiles)
    const netlify = await readDirectoryFromNetlify()
    let dir = mergeRoomDirectories([
      layers.file,
      layers.blob,
      layers.cache,
      layers.snapshot,
      netlify,
    ])
    dir = await hydrateDurableRooms(dir)
    const ledger = await loadTaskLedger()
    dir = {
      ...dir,
      rooms: applyLedgerToRooms(dir.rooms, ledger),
    }
    for (const [code, entry] of Object.entries(ledger.rooms)) {
      if (dir.rooms[code] || Object.keys(entry.tasks).length === 0) continue
      const info = classFromCode(code)
      if (!info) continue
      dir.rooms[code] = reviveRoomFromLedger(createClassRoom(info), ledger)
    }
    if (layers.snapshot) {
      dir = keepKnownRooms(layers.snapshot, dir)
    }
    rememberSnapshot(DIRECTORY_KEY, dir)
    const unreliable = layers.unreliable
    const confirmedEmpty =
      layers.confirmedEmpty && Object.keys(dir.rooms).length === 0
    directoryCache = { loadedAt: Date.now(), dir, unreliable, confirmedEmpty }
    return { dir, unreliable, confirmedEmpty }
  })().finally(() => {
    directoryInflight = null
  })

  return directoryInflight
}

export async function saveRoomInDirectory(room: Room): Promise<RoomDirectory> {
  const previous = peekSnapshot<RoomDirectory>(DIRECTORY_KEY)
  const { dir: current, unreliable, confirmedEmpty } = await loadRoomDirectory({
    fresh: true,
  })
  if (unreliable && Object.keys(current.rooms).length === 0 && !confirmedEmpty) {
    throw new SharedStoreUnavailableError(
      "반 데이터를 불러오지 못해 저장하지 않았습니다."
    )
  }
  let next = mergeRoomDirectories([
    previous,
    current,
    {
      rooms: { [room.code]: room },
      updatedAt: new Date().toISOString(),
    },
  ])
  if (previous) next = keepKnownRooms(previous, next)
  const dropped = droppedTaskIds(current.rooms[room.code]?.tasks ?? [], room.tasks ?? [])
  if (next.rooms[room.code]) {
    const ledger = await persistRoomTasks(room.code, room.tasks ?? [], dropped)
    next = {
      ...next,
      rooms: {
        ...next.rooms,
        [room.code]: reviveRoomFromLedger(
          { ...next.rooms[room.code], tasks: room.tasks ?? [] },
          ledger,
          dropped
        ),
      },
    }
  }
  directoryCache = {
    loadedAt: Date.now(),
    dir: next,
    unreliable: false,
    confirmedEmpty: false,
  }
  rememberSnapshot(DIRECTORY_KEY, next)
  await writeSharedJson(DIRECTORY_KEY, next, async () => {
    await writeJsonFile(DIRECTORY_FILE, next)
    await writeJsonFile(path.join(FILE_DIR, `${room.code}.json`), next.rooms[room.code] ?? room)
  })
  await persistDurableRooms(next)
  return next
}

export async function saveRoomDirectory(nextDir: RoomDirectory): Promise<RoomDirectory> {
  const previous = peekSnapshot<RoomDirectory>(DIRECTORY_KEY)
  const { dir: current, unreliable, confirmedEmpty } = await loadRoomDirectory({
    fresh: true,
  })
  if (unreliable && Object.keys(current.rooms).length === 0 && !confirmedEmpty) {
    throw new SharedStoreUnavailableError(
      "반 데이터를 불러오지 못해 저장하지 않았습니다."
    )
  }
  let next = mergeRoomDirectories([previous, current, nextDir])
  if (previous) next = keepKnownRooms(previous, next)
  next = keepKnownRooms(current, next)
  const ledger = await persistTaskLedgerFromRooms(next.rooms)
  next = { ...next, rooms: applyLedgerToRooms(next.rooms, ledger) }
  directoryCache = {
    loadedAt: Date.now(),
    dir: next,
    unreliable: false,
    confirmedEmpty: false,
  }
  rememberSnapshot(DIRECTORY_KEY, next)
  await writeSharedJson(DIRECTORY_KEY, next, async () => {
    await writeJsonFile(DIRECTORY_FILE, next)
    await Promise.all(
      Object.values(next.rooms).map((item) =>
        writeJsonFile(path.join(FILE_DIR, `${item.code}.json`), item)
      )
    )
  })
  await persistDurableRooms(next)
  return next
}

export function peekRoomDirectory(): RoomDirectory {
  return peekSnapshot<RoomDirectory>(DIRECTORY_KEY) ?? emptyRoomDirectory()
}
