import assert from "node:assert/strict"
import test from "node:test"
import type { Room, SchoolNotesDocument } from "../entities/board.ts"
import {
  clearUserRecordsFromRoom,
  clearUserRecordsFromSchoolNotes,
} from "./user-records.ts"

function room(partial: Partial<Room>): Room {
  return {
    code: "BAN1",
    title: "1반",
    subject: "",
    description: "",
    deadline: "",
    createdBy: "u",
    createdAt: "1",
    updatedAt: "1",
    revision: 1,
    notes: "",
    members: [],
    tasks: [],
    updates: [],
    notesHistory: [],
    ...partial,
  }
}

test("removes that person's 소식, 댓글, created 할 일, and 수정기록", () => {
  const next = clearUserRecordsFromRoom(
    room({
      updates: [
        { id: "u1", author: "민수", authorId: "stu", text: "hi", createdAt: "1" },
        { id: "u2", author: "다른", authorId: "other", text: "yo", createdAt: "2" },
      ],
      tasks: [
        {
          id: "t1",
          title: "실험",
          notes: "",
          dueDate: "",
          assigneeIds: [],
          createdAt: "1",
          comments: [
            { id: "c1", authorId: "stu", author: "민수", text: "나", createdAt: "2" },
            { id: "c2", authorId: "other", author: "다른", text: "너", createdAt: "3" },
          ],
        },
        {
          id: "t2",
          title: "숙제",
          notes: "",
          dueDate: "",
          assigneeIds: [],
          createdAt: "1",
          comments: [],
        },
      ],
      notesHistory: [
        {
          id: "h1",
          authorId: "stu",
          author: "민수",
          added: "숙제",
          removed: "",
          taskTitle: "숙제",
          createdAt: "1",
        },
        {
          id: "h2",
          authorId: "stu",
          author: "민수",
          added: "노트",
          removed: "",
          noteKind: "korean",
          createdAt: "2",
        },
        {
          id: "h3",
          authorId: "other",
          author: "다른",
          added: "실험",
          removed: "",
          taskTitle: "실험",
          createdAt: "1",
        },
      ],
    }),
    "stu"
  )

  assert.equal(next.cleared.updates, 1)
  assert.equal(next.cleared.comments, 1)
  assert.equal(next.cleared.tasks, 1)
  assert.equal(next.cleared.history, 2)
  assert.equal(next.room.updates.length, 1)
  assert.equal(next.room.updates[0]?.authorId, "other")
  assert.equal(next.room.tasks.length, 1)
  assert.equal(next.room.tasks[0]?.title, "실험")
  assert.equal(next.room.tasks[0]?.comments.length, 1)
  assert.equal(next.room.notesHistory?.length, 1)
})

test("school notes only drop that person's history rows", () => {
  const doc: SchoolNotesDocument = {
    notes: { english_s: "keep" } as SchoolNotesDocument["notes"],
    revision: 3,
    createdAt: "1",
    updatedAt: "1",
    notesHistory: [
      {
        id: "h1",
        authorId: "stu",
        author: "민수",
        added: "spam",
        removed: "",
        noteKind: "english_s",
        createdAt: "2",
      },
      {
        id: "h2",
        authorId: "other",
        author: "다른",
        added: "ok",
        removed: "",
        noteKind: "english_s",
        createdAt: "3",
      },
    ],
  }
  const next = clearUserRecordsFromSchoolNotes(doc, "stu")
  assert.equal(next.cleared.history, 1)
  assert.equal(next.doc.notes.english_s, "keep")
  assert.equal(next.doc.notesHistory?.length, 1)
  assert.equal(next.doc.notesHistory?.[0]?.authorId, "other")
})
