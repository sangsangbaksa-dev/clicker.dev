import assert from "node:assert/strict"
import test from "node:test"
import type { Room, SchoolNotesDocument } from "../entities/board.ts"
import {
  mergeRoomOnConflict,
  mergeSchoolNotesOnConflict,
  mergeTextFieldOnConflict,
} from "./conflict-merge.ts"

test("keeps remote text when this client did not edit the field", () => {
  assert.equal(mergeTextFieldOnConflict("their edit", "base", "base"), "their edit")
})

test("keeps local text when the other client did not edit the field", () => {
  assert.equal(mergeTextFieldOnConflict("base", "my edit", "base"), "my edit")
})

test("keeps this client's draft when both edited the same field", () => {
  assert.equal(mergeTextFieldOnConflict("their edit", "my edit", "base"), "my edit")
})

function room(partial: Partial<Room> & Pick<Room, "notes" | "subjectNotes">): Room {
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
    members: [],
    tasks: [],
    updates: [],
    groups: [],
    ...partial,
  }
}

test("conflict merge keeps my 국어 note and their 과학 note", () => {
  const baseNotes = { general: "", korean: "old korean", science: "old science" }
  const localNotes = { ...baseNotes, korean: "my korean" }
  const remoteNotes = { ...baseNotes, science: "their science" }
  const merged = mergeRoomOnConflict(
    room({ notes: localNotes.general, subjectNotes: localNotes as Room["subjectNotes"], revision: 1 }),
    room({ notes: remoteNotes.general, subjectNotes: remoteNotes as Room["subjectNotes"], revision: 2 }),
    room({ notes: baseNotes.general, subjectNotes: baseNotes as Room["subjectNotes"], revision: 1 })
  )
  assert.equal(merged.subjectNotes?.korean, "my korean")
  assert.equal(merged.subjectNotes?.science, "their science")
  assert.equal(merged.revision, 2)
})

test("conflict merge keeps a deleted 조 gone", () => {
  const one = {
    id: "g1",
    n: 1,
    name: "",
    memberIds: [] as string[],
    createdAt: "1",
    documents: [],
    messages: [],
    typing: [],
  }
  const two = { ...one, id: "g2", n: 2, createdAt: "2" }
  const merged = mergeRoomOnConflict(
    room({ notes: "", subjectNotes: {}, groups: [two], revision: 1 }),
    room({ notes: "", subjectNotes: {}, groups: [one, two], revision: 2 }),
    room({ notes: "", subjectNotes: {}, groups: [one, two], revision: 1 })
  )
  assert.deepEqual(
    (merged.groups ?? []).map((group) => group.id),
    ["g2"]
  )
})

test("school-note conflict merge keeps my English S and their Math S", () => {
  const baseNotes = { english_s: "old en", math_s: "old math" }
  const base: SchoolNotesDocument = {
    notes: baseNotes as SchoolNotesDocument["notes"],
    revision: 1,
    createdAt: "1",
    updatedAt: "1",
  }
  const local: SchoolNotesDocument = {
    ...base,
    notes: { ...base.notes, english_s: "my en" },
  }
  const remote: SchoolNotesDocument = {
    ...base,
    notes: { ...base.notes, math_s: "their math" },
    revision: 2,
  }
  const merged = mergeSchoolNotesOnConflict(local, remote, base)
  assert.equal(merged.notes.english_s, "my en")
  assert.equal(merged.notes.math_s, "their math")
  assert.equal(merged.revision, 2)
})
