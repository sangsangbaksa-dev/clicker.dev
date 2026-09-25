/**
 * Lightweight checks for save-safety helpers (no server required).
 * Run: node scripts/test-save-safety.mjs
 */

function mergeLocalEditsOnConflict(local, remote) {
  return {
    ...remote,
    notes: local.notes,
    subjectNotes: local.subjectNotes,
    tasks: local.tasks,
    title: local.title,
    subject: local.subject,
    description: local.description,
    deadline: local.deadline,
    revision: remote.revision,
  }
}

const local = {
  code: "BAN1",
  revision: 3,
  notes: "내가 쓰던 노트",
  subjectNotes: { general: "내가 쓰던 노트", korean: "", science: "", social: "", technology: "", ethics: "", pe: "", music: "", art: "" },
  tasks: [{ id: "t1", title: "로컬 할일", comments: [{ id: "c1", text: "로컬 댓글" }] }],
  title: "로컬 제목",
  subject: "",
  description: "",
  deadline: "",
  members: [{ id: "a", name: "A", lastSeenAt: "2026-01-01" }],
  updates: [{ id: "u1", text: "로컬" }],
}

const remote = {
  ...local,
  revision: 5,
  notes: "서버 노트",
  tasks: [{ id: "t2", title: "서버 할일", comments: [] }],
  members: [
    { id: "a", name: "A", lastSeenAt: "2026-01-02" },
    { id: "b", name: "B", lastSeenAt: "2026-01-02" },
  ],
  updates: [{ id: "u2", text: "서버" }],
}

const merged = mergeLocalEditsOnConflict(local, remote)

const checks = [
  ["keeps local notes", merged.notes === "내가 쓰던 노트"],
  ["keeps local subject notes", merged.subjectNotes?.general === "내가 쓰던 노트"],
  ["keeps local tasks", merged.tasks[0].id === "t1"],
  ["keeps local task comments", merged.tasks[0].comments[0].id === "c1"],
  ["adopts server revision", merged.revision === 5],
  ["adopts server members", merged.members.length === 2],
  ["adopts server updates", merged.updates[0].id === "u2"],
]

let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} | ${label}`)
  if (!ok) failed += 1
}

process.exit(failed ? 1 : 0)
