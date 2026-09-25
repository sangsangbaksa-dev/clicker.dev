import assert from "node:assert/strict"
import test from "node:test"
import type { ClassGroup, GroupDocument } from "@/domain/entities/board"
import {
  addGroupDocument,
  applyDocumentSave,
  canReadGroupDocuments,
  canWriteGroupDocuments,
  documentCharCount,
  emptyDocument,
  hydrateGroupDocuments,
  MAX_GROUP_DOCUMENTS,
  mergeDocumentsOnConflict,
  preserveGroupDocuments,
  removeGroupDocument,
  roomWithoutGroupDocuments,
  sanitizeDocuments,
  UNTITLED_DOCUMENT,
} from "./group-docs.ts"

function doc(partial: Partial<GroupDocument> & Pick<GroupDocument, "id">): GroupDocument {
  return {
    title: UNTITLED_DOCUMENT,
    body: "",
    revision: 1,
    updatedAt: "1",
    updatedById: "",
    updatedBy: "",
    ...partial,
  }
}

function group(partial: Partial<ClassGroup> & Pick<ClassGroup, "id" | "n">): ClassGroup {
  return {
    name: "",
    memberIds: [],
    createdAt: "1",
    documents: [emptyDocument(partial.id, "1")],
    messages: [],
    typing: [],
    ...partial,
  }
}

test("empty or junk document lists become one untitled paper", () => {
  const docs = sanitizeDocuments([], "g1", "1")
  assert.equal(docs.length, 1)
  assert.equal(docs[0]?.id, "g1:main")
  assert.equal(docs[0]?.title, UNTITLED_DOCUMENT)
})

test("only 조원 may read or write the papers", () => {
  const one = group({ id: "g1", n: 1, memberIds: ["usr_a"] })
  assert.equal(canReadGroupDocuments(one, "usr_a", false), true)
  assert.equal(canWriteGroupDocuments(one, "usr_a", false), true)
  assert.equal(canReadGroupDocuments(one, "usr_b", false), false)
  assert.equal(canReadGroupDocuments(one, "usr_b", true), false)
  assert.equal(canWriteGroupDocuments(one, "waldo", true), false)
})

test("saving a paper bumps revision and stamps the editor", () => {
  const start = group({ id: "g1", n: 1, memberIds: ["usr_a"] })
  const next = applyDocumentSave(
    start,
    "g1:main",
    { title: "실험 계획", body: "가설" },
    { id: "usr_a", name: "민준" },
    "2"
  )
  assert.equal(next?.documents[0]?.title, "실험 계획")
  assert.equal(next?.documents[0]?.body, "가설")
  assert.equal(next?.documents[0]?.revision, 2)
  assert.equal(next?.documents[0]?.updatedBy, "민준")
})

test("board PUT keeps stored papers and ignores client bodies", () => {
  const previous = [
    group({
      id: "g1",
      n: 1,
      memberIds: ["usr_a"],
      documents: [doc({ id: "g1:main", title: "비밀", body: "본문", revision: 4 })],
    }),
  ]
  const incoming = [
    group({
      id: "g1",
      n: 1,
      memberIds: ["usr_a", "usr_b"],
      documents: [doc({ id: "forged", title: "위조", body: "지움" })],
    }),
  ]
  const merged = preserveGroupDocuments(previous, incoming)
  assert.deepEqual(merged[0]?.memberIds, ["usr_a", "usr_b"])
  assert.equal(merged[0]?.documents[0]?.title, "비밀")
  assert.equal(merged[0]?.documents[0]?.revision, 4)
})

test("hydrate reattaches stored papers onto stripped membership rows", () => {
  const membership = [group({ id: "grp_a", n: 1, documents: [] })]
  const hydrated = hydrateGroupDocuments(membership, [
    {
      id: "grp_a",
      documents: [doc({ id: "grp_a:main", title: "계획", body: "가설", revision: 2 })],
    },
  ])
  assert.equal(hydrated[0]?.documents[0]?.title, "계획")
  assert.equal(hydrated[0]?.documents[0]?.body, "가설")
})

test("a new 조 on PUT gets an untitled paper", () => {
  const merged = preserveGroupDocuments([], [group({ id: "g2", n: 2, documents: [] })])
  assert.equal(merged[0]?.documents[0]?.id, "g2:main")
})

test("board payloads strip papers so 조 명단 autosave cannot clobber them", () => {
  const publicRoom = roomWithoutGroupDocuments({
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
    groups: [
      group({
        id: "g1",
        n: 1,
        documents: [doc({ id: "g1:main", title: "비밀", body: "본문" })],
      }),
    ],
  })
  assert.deepEqual(publicRoom.groups?.[0]?.documents, [])
})

test("conflict merge keeps my title and their other paper", () => {
  const base = [doc({ id: "a", title: "old", body: "old" })]
  const local = [doc({ id: "a", title: "mine", body: "old" })]
  const remote = [
    doc({ id: "a", title: "old", body: "old", revision: 2 }),
    doc({ id: "b", title: "theirs", body: "new", revision: 1 }),
  ]
  const merged = mergeDocumentsOnConflict(local, remote, base)
  assert.equal(merged.find((item) => item.id === "a")?.title, "mine")
  assert.equal(merged.find((item) => item.id === "b")?.title, "theirs")
  assert.equal(merged.find((item) => item.id === "a")?.revision, 2)
})

test("cannot delete the last paper or exceed the cap", () => {
  const start = group({ id: "g1", n: 1 })
  assert.equal(removeGroupDocument(start, "g1:main"), null)
  let current = start
  for (let i = 0; i < MAX_GROUP_DOCUMENTS; i += 1) {
    const next = addGroupDocument(current, `extra_${i}`, "2")
    if (!next) break
    current = next
  }
  assert.equal(current.documents.length, MAX_GROUP_DOCUMENTS)
  assert.equal(addGroupDocument(current, "overflow", "3"), null)
})

test("character count ignores whitespace", () => {
  assert.equal(documentCharCount("가 나\n다"), 3)
})
