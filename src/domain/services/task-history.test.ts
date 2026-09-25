import assert from "node:assert/strict"
import test from "node:test"
import { listTaskWriteChanges, mergeItemsOnConflict, taskWriteText } from "./task-history.ts"

test("serializes title, due date, and notes", () => {
  assert.equal(
    taskWriteText({ title: " 수학 ", notes: "쪽수", dueDate: "2026-09-20" }),
    "수학\n마감 2026-09-20\n쪽수"
  )
})

test("records a new 할 일 as added text", () => {
  const changes = listTaskWriteChanges(
    [],
    [
      {
        id: "t1",
        title: "실험",
        notes: "준비물",
        dueDate: "",
        assigneeIds: [],
        createdAt: "1",
        comments: [],
      },
    ]
  )
  assert.equal(changes.length, 1)
  assert.equal(changes[0]?.previousText, "")
  assert.equal(changes[0]?.nextText, "실험\n준비물")
  assert.equal(changes[0]?.taskTitle, "실험")
})

test("ignores comment-only edits", () => {
  const task = {
    id: "t1",
    title: "실험",
    notes: "",
    dueDate: "",
    assigneeIds: [],
    createdAt: "1",
    comments: [],
  }
  const changes = listTaskWriteChanges(
    [task],
    [{ ...task, comments: [{ id: "c1", authorId: "u", author: "A", text: "hi", createdAt: "2" }] }]
  )
  assert.equal(changes.length, 0)
})

test("records deleted 할 일 as removed text", () => {
  const changes = listTaskWriteChanges(
    [
      {
        id: "t1",
        title: "실험",
        notes: "",
        dueDate: "2026-09-20",
        assigneeIds: [],
        createdAt: "1",
        comments: [],
      },
    ],
    []
  )
  assert.equal(changes.length, 1)
  assert.equal(changes[0]?.nextText, "")
  assert.equal(changes[0]?.previousText, "실험\n마감 2026-09-20")
})

test("conflict merge keeps the other computer's 할 일 and local-only drafts", () => {
  const merged = mergeItemsOnConflict(
    [
      { id: "mine" },
      { id: "shared" },
    ],
    [
      { id: "shared" },
      { id: "theirs" },
    ]
  )
  assert.deepEqual(
    merged.map((item) => item.id),
    ["shared", "theirs", "mine"]
  )
})
