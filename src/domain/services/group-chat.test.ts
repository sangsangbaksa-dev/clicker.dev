import assert from "node:assert/strict"
import test from "node:test"
import type { ClassGroup, GroupMessage } from "@/domain/entities/board"
import {
  appendGroupMessage,
  canPostGroupChat,
  canReadGroupChat,
  inspectGroupChatImage,
  messagesStamp,
  preserveGroupMessages,
  sanitizeGroupMessages,
  setTyping,
} from "./group-chat.ts"

function group(partial: Partial<ClassGroup> & Pick<ClassGroup, "id" | "n">): ClassGroup {
  return {
    name: "",
    memberIds: [],
    createdAt: "1",
    documents: [],
    messages: [],
    typing: [],
    ...partial,
  }
}

test("only 조원 may read or write chat", () => {
  const one = group({ id: "g1", n: 1, memberIds: ["usr_a"] })
  assert.equal(canReadGroupChat(one, "usr_a", false), true)
  assert.equal(canPostGroupChat(one, "usr_a", false), true)
  assert.equal(canReadGroupChat(one, "usr_b", false), false)
  assert.equal(canPostGroupChat(one, "usr_b", false), false)
  assert.equal(canReadGroupChat(one, "usr_b", true), false)
})

test("png bytes are accepted and junk is not", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  assert.equal(inspectGroupChatImage(png).ok, true)
  assert.equal(inspectGroupChatImage(new Uint8Array([1, 2, 3, 4])).ok, false)
})

test("board PUT keeps stored chat and ignores client bodies", () => {
  const previous = [
    group({
      id: "g1",
      n: 1,
      memberIds: ["usr_a"],
      messages: [{ id: "m1", authorId: "usr_a", author: "민준", body: "비밀", createdAt: "1" }],
    }),
  ]
  const incoming = [
    group({
      id: "g1",
      n: 1,
      memberIds: ["usr_a", "usr_b"],
      messages: [{ id: "forged", authorId: "usr_b", author: "위조", body: "지움", createdAt: "9" }],
    }),
  ]
  const merged = preserveGroupMessages(previous, incoming)
  assert.deepEqual(merged[0]?.memberIds, ["usr_a", "usr_b"])
  assert.equal(merged[0]?.messages[0]?.body, "비밀")
})

test("append keeps the thread on that 조 only", () => {
  const groups = [
    group({ id: "g1", n: 1, memberIds: ["usr_a"] }),
    group({ id: "g2", n: 2, memberIds: ["usr_b"] }),
  ]
  const next = appendGroupMessage(groups, "g1", {
    id: "m1",
    authorId: "usr_a",
    author: "민준",
    body: "숙제",
    createdAt: "1",
  })
  assert.equal(next[0]?.messages[0]?.body, "숙제")
  assert.deepEqual(next[1]?.messages, [])
})

test("stamp changes when a line is added", () => {
  const empty: GroupMessage[] = []
  const one: GroupMessage[] = [
    { id: "m1", authorId: "usr_a", author: "민준", body: "안녕", createdAt: "1" },
  ]
  assert.notEqual(messagesStamp(empty), messagesStamp(one))
})

test("drops empty chat lines", () => {
  assert.deepEqual(
    sanitizeGroupMessages([{ id: "x", authorId: "usr_a", author: "민준", body: "  ", createdAt: "1" }]),
    []
  )
})

test("typing is keyed per person and surface", () => {
  const typing = setTyping([], { id: "usr_a", name: "민준" }, "chat", new Date().toISOString())
  assert.equal(typing[0]?.name, "민준")
  assert.equal(typing[0]?.surface, "chat")
})
