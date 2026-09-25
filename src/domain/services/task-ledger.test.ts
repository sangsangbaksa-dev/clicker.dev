import assert from "node:assert/strict"
import test from "node:test"
import type { Room, Task } from "../entities/board.ts"
import {
  applyLedgerToRooms,
  droppedTaskIds,
  dropAllLedgerTasks,
  dropLedgerTasks,
  ledgerFromRooms,
  mergeTaskLedgers,
  mergeTaskLists,
  reviveRoomFromLedger,
} from "./task-ledger.ts"

function task(id: string, title: string, createdAt = "2026-09-01T00:00:00.000Z"): Task {
  return {
    id,
    title,
    notes: "",
    dueDate: "",
    assigneeIds: [],
    createdAt,
    comments: [],
  }
}

function room(code: string, tasks: Task[]): Room {
  return {
    code,
    title: code,
    subject: "",
    description: "",
    deadline: "",
    createdBy: "u",
    createdAt: "1",
    updatedAt: "1",
    revision: 1,
    notes: "",
    members: [],
    tasks,
    updates: [],
  }
}

test("task ledger is append-only across a sparse overwrite", () => {
  const full = ledgerFromRooms(
    { BAN1: room("BAN1", [task("task_a", "조사"), task("task_b", "보고서")]) },
    "1"
  )
  const sparse = ledgerFromRooms({ BAN1: room("BAN1", []) }, "2")
  const merged = mergeTaskLedgers([sparse, full])
  assert.equal(merged.rooms.BAN1?.tasks.task_a?.title, "조사")
  assert.equal(merged.rooms.BAN1?.tasks.task_b?.title, "보고서")
})

test("only explicit deletes drop a task from the ledger", () => {
  const ledger = ledgerFromRooms(
    { BAN1: room("BAN1", [task("task_a", "조사"), task("task_b", "보고서")]) },
    "1"
  )
  const next = dropLedgerTasks(ledger, "BAN1", ["task_a"])
  assert.equal(next.rooms.BAN1?.tasks.task_a, undefined)
  assert.equal(next.rooms.BAN1?.tasks.task_b?.title, "보고서")
  assert.deepEqual(next.droppedIds.BAN1, ["task_a"])
})

test("bundled ledger cannot revive a dropped 할 일", () => {
  const live = dropLedgerTasks(
    ledgerFromRooms({ BAN1: room("BAN1", [task("task_a", "조사")]) }, "2"),
    "BAN1",
    ["task_a"]
  )
  const bundled = ledgerFromRooms(
    { BAN1: room("BAN1", [task("task_a", "조사")]) },
    "1"
  )
  const merged = mergeTaskLedgers([bundled, live])
  assert.equal(merged.rooms.BAN1, undefined)
  assert.deepEqual(merged.droppedIds.BAN1, ["task_a"])
})

test("a sparse room cannot tombstone ledger tasks", () => {
  const ledger = ledgerFromRooms(
    { BAN1: room("BAN1", [task("task_a", "조사")]) },
    "1"
  )
  const revived = reviveRoomFromLedger(room("BAN1", []), ledger)
  assert.equal(revived.tasks[0]?.title, "조사")
})

test("applyLedgerToRooms restores 할 일 onto every class board", () => {
  const ledger = ledgerFromRooms(
    { BAN1: room("BAN1", [task("task_a", "조사")]), ENGS: room("ENGS", [task("task_e", "단어")]) },
    "1"
  )
  const rooms = applyLedgerToRooms(
    { BAN1: room("BAN1", []), ENGS: room("ENGS", []) },
    ledger
  )
  assert.equal(rooms.BAN1?.tasks[0]?.title, "조사")
  assert.equal(rooms.ENGS?.tasks[0]?.title, "단어")
})

test("droppedTaskIds lists tasks the client actually removed", () => {
  const previous = [task("task_a", "조사"), task("task_b", "보고서")]
  const incoming = [task("task_b", "보고서")]
  assert.deepEqual(droppedTaskIds(previous, incoming), ["task_a"])
})

test("dropAllLedgerTasks tombstones every 할 일", () => {
  const ledger = ledgerFromRooms(
    {
      BAN1: room("BAN1", [task("task_a", "조사")]),
      BAN4: room("BAN4", [task("task_b", "보고서")]),
    },
    "1"
  )
  const { ledger: next, dropped } = dropAllLedgerTasks(ledger)
  assert.equal(Object.keys(next.rooms).length, 0)
  assert.equal(dropped.length, 2)
  assert.deepEqual(next.droppedIds.BAN1, ["task_a"])
  assert.deepEqual(next.droppedIds.BAN4, ["task_b"])
})

test("mergeTaskLists keeps the copy with more comments", () => {
  const plain = task("task_a", "조사")
  const commented: Task = {
    ...plain,
    comments: [
      {
        id: "c1",
        authorId: "u",
        author: "이찬형",
        text: "링크",
        createdAt: "2",
      },
    ],
  }
  const merged = mergeTaskLists([[plain], [commented]])
  assert.equal(merged[0]?.comments.length, 1)
})
