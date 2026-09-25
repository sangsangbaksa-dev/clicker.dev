import assert from "node:assert/strict"
import test from "node:test"
import type { ClassGroup } from "@/domain/entities/board"
import {
  addEmptyGroup,
  commitGroupEdit,
  dropMemberFromGroups,
  exclusiveGroupMembers,
  groupForMember,
  groupLabel,
  groupSummaryLine,
  MAX_CLASS_GROUPS,
  nextGroupNumber,
  mergeGroupsOnConflict,
  patchGroup,
  removeGroup,
  sanitizeGroups,
  ungroupedIds,
} from "./class-groups.ts"

function group(partial: Partial<ClassGroup> & Pick<ClassGroup, "id" | "n">): ClassGroup {
  return {
    name: "",
    memberIds: [],
    createdAt: String(partial.n),
    documents: [],
    messages: [],
    typing: [],
    ...partial,
  }
}

test("labels 조 by number, and an extra name if it is not just N조", () => {
  assert.equal(groupLabel({ n: 1, name: "" }), "1조")
  assert.equal(groupLabel({ n: 2, name: "2조" }), "2조")
  assert.equal(groupLabel({ n: 3, name: "실험" }), "3조 실험")
})

test("fills the lowest unused 조 number", () => {
  assert.equal(nextGroupNumber([]), 1)
  assert.equal(nextGroupNumber([{ n: 1 }, { n: 3 }]), 2)
})

test("sanitize drops bad rows, leftover 조장 fields, and client document bodies", () => {
  const groups = sanitizeGroups([
    {
      id: "grp_a",
      n: 1,
      name: "  실험  ",
      leaderId: "usr_x",
      memberIds: ["usr_a", "usr_a", "usr_b"],
      createdAt: "2026-09-15T00:00:00.000Z",
      documents: [{ id: "g1:main", title: "비밀", body: "본문", revision: 3, updatedAt: "1", updatedById: "usr_a", updatedBy: "민준" }],
    },
    { id: "grp_b", n: 1, name: "dup", memberIds: [], createdAt: "" },
    { id: "", n: 2, name: "no-id", memberIds: [], createdAt: "" },
  ])
  assert.equal(groups.length, 1)
  assert.equal(groups[0]?.name, "실험")
  assert.deepEqual(groups[0]?.memberIds, ["usr_a", "usr_b"])
  assert.deepEqual(groups[0]?.documents, [])
  assert.equal("leaderId" in (groups[0] as object), false)
})

test("a student cannot sit in two 조", () => {
  const cleaned = exclusiveGroupMembers([
    group({ id: "g1", n: 1, memberIds: ["usr_a", "usr_b"], createdAt: "1" }),
    group({ id: "g2", n: 2, memberIds: ["usr_b", "usr_c"], createdAt: "2" }),
  ])
  assert.deepEqual(
    cleaned.map((item) => [item.n, item.memberIds]),
    [
      [1, ["usr_a"]],
      [2, ["usr_b", "usr_c"]],
    ]
  )
})

test("patching members pulls them out of the other 조", () => {
  const start = [
    group({ id: "g1", n: 1, memberIds: ["usr_a"], createdAt: "1" }),
    group({ id: "g2", n: 2, createdAt: "2" }),
  ]
  const next = patchGroup(start, "g2", { memberIds: ["usr_a", "usr_c"] })
  const one = next.find((item) => item.id === "g1")
  const two = next.find((item) => item.id === "g2")
  assert.deepEqual(one?.memberIds, [])
  assert.deepEqual(two?.memberIds, ["usr_a", "usr_c"])
})

test("add / remove 조 and list who is not in one", () => {
  let groups = addEmptyGroup([], "g1", "1")
  assert.equal(groups.length, 1)
  assert.equal(groups[0]?.n, 1)
  groups = addEmptyGroup(groups, "g2", "2")
  assert.equal(groups.map((item) => item.n).join(","), "1,2")
  groups = removeGroup(groups, groups[0]!.id)
  assert.equal(groups[0]?.n, 2)
  assert.deepEqual(ungroupedIds(["usr_a", "usr_b"], groups), ["usr_a", "usr_b"])
})

test("removing a 조 drops its papers and does not come back on conflict", () => {
  const one = group({
    id: "g1",
    n: 1,
    memberIds: ["usr_a"],
    createdAt: "1",
    documents: [
      {
        id: "g1:main",
        title: "계획",
        body: "가설",
        revision: 2,
        updatedAt: "1",
        updatedById: "usr_a",
        updatedBy: "민준",
      },
    ],
  })
  const two = group({ id: "g2", n: 2, memberIds: ["usr_b"], createdAt: "2" })
  const kept = removeGroup([one, two], "g1")
  assert.equal(kept.length, 1)
  assert.equal(kept[0]?.id, "g2")
  const merged = mergeGroupsOnConflict(kept, [one, two], [one, two])
  assert.deepEqual(
    merged.map((item) => item.id),
    ["g2"]
  )
})

test("conflict merge keeps a deleted 조 gone and adds a new remote 조", () => {
  const one = group({ id: "g1", n: 1, createdAt: "1" })
  const two = group({ id: "g2", n: 2, createdAt: "2" })
  const three = group({ id: "g3", n: 3, createdAt: "3" })
  const merged = mergeGroupsOnConflict([two], [one, two, three], [one, two])
  assert.deepEqual(
    merged.map((item) => item.id),
    ["g2", "g3"]
  )
})

test("home line stays short", () => {
  assert.equal(
    groupSummaryLine([
      { n: 1, name: "", memberCount: 4 },
      { n: 2, name: "실험", memberCount: 0 },
    ]),
    "1조 4 · 2조 실험"
  )
})

test("saving a new 조 does not require it to already be in the list", () => {
  const saved = commitGroupEdit([], {
    id: "g1",
    createdAt: "1",
    name: "실험",
    memberIds: ["usr_a", "usr_b"],
  })
  assert.equal(saved.length, 1)
  assert.equal(saved[0]?.n, 1)
  assert.equal(saved[0]?.name, "실험")
  assert.deepEqual(saved[0]?.memberIds, ["usr_a", "usr_b"])
})

test("patching a 조 that is not in the list leaves existing 조 alone", () => {
  const start = addEmptyGroup([], "g1", "1")
  const next = patchGroup(start, "missing", { memberIds: ["usr_a"] })
  assert.equal(next.length, 1)
  assert.deepEqual(next[0]?.memberIds, [])
})

test("removed students leave every 조 and keep the papers", () => {
  const next = dropMemberFromGroups(
    [
      group({
        id: "g1",
        n: 1,
        memberIds: ["usr_a", "usr_b"],
        createdAt: "1",
        documents: [
          {
            id: "g1:main",
            title: "계획",
            body: "가설",
            revision: 2,
            updatedAt: "1",
            updatedById: "usr_a",
            updatedBy: "민준",
          },
        ],
      }),
    ],
    "usr_a"
  )
  assert.deepEqual(next[0]?.memberIds, ["usr_b"])
  assert.equal(next[0]?.documents[0]?.body, "가설")
})

test("finds the 조 a student sits in", () => {
  const groups = [
    group({ id: "g1", n: 1, memberIds: ["usr_a"], createdAt: "1" }),
    group({ id: "g2", n: 2, memberIds: ["usr_b"], createdAt: "2" }),
  ]
  assert.equal(groupForMember(groups, "usr_b")?.id, "g2")
  assert.equal(groupForMember(groups, "usr_z"), undefined)
})

test("caps how many 조 a class can hold", () => {
  let groups = addEmptyGroup([], "g0", "0")
  for (let i = 1; i < 20; i += 1) groups = addEmptyGroup(groups, `g${i}`, String(i))
  assert.equal(groups.length, MAX_CLASS_GROUPS)
})
