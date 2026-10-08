import assert from "node:assert/strict"
import test from "node:test"
import {
  LEADERBOARD_MAX_ENTRIES,
  leaderboardEntryFromSave,
  leaderboardView,
  publicLeaderboardRow,
  upsertLeaderboard,
  type Leaderboard,
} from "./clicker-leaderboard.ts"

const save = (meta: Record<string, unknown>) => JSON.stringify({ metaState: meta })
const HOUR = 3_600_000

test("leaderboard: rows come from the stored save, clears only when the ending is sealed", () => {
  const open = leaderboardEntryFromSave(save({ totalCoreEnergy: 5e9, startedAt: 0, rebirthCount: 3, transcendenceIds: ["a", "b"] }), { id: "p1", nickname: "광부" }, 2 * HOUR)
  assert.ok(open)
  assert.equal(open.clearMs, null)
  assert.equal(open.playTimeMs, 2 * HOUR)
  assert.equal(open.worldlinesOwned, 2)
  const done = leaderboardEntryFromSave(
    save({ totalCoreEnergy: 9e12, startedAt: 0, gameCompleted: true, completedAt: 5 * HOUR, transcendenceIds: [] }),
    { id: "p1", nickname: "광부" },
    6 * HOUR,
  )
  assert.equal(done?.clearMs, 5 * HOUR)
  // A completedAt without gameCompleted is not a clear.
  assert.equal(leaderboardEntryFromSave(save({ totalCoreEnergy: 1, startedAt: 0, completedAt: 10 }), { id: "x", nickname: "" }, 20)?.clearMs, null)
  assert.equal(leaderboardEntryFromSave("not json", { id: "x", nickname: "" }, 0), null)
})

test("leaderboard: best clear and most CORE are kept, boards sort the right way, ids stay private", () => {
  const row = (id: string, totalCore: number, clearMs: number | null) =>
    leaderboardEntryFromSave(
      save({ totalCoreEnergy: totalCore, startedAt: 0, gameCompleted: clearMs !== null, completedAt: clearMs }),
      { id, nickname: id },
      10 * HOUR,
    )!
  let board: Leaderboard = { entries: [] }
  board = upsertLeaderboard(board, row("slow", 1e15, 9 * HOUR))
  board = upsertLeaderboard(board, row("fast", 1e12, 4 * HOUR))
  board = upsertLeaderboard(board, row("rich", 1e18, null))
  // "fast" starts a new run after the ending: the clear and the old CORE peak stay on the board.
  board = upsertLeaderboard(board, row("fast", 10, null))
  const clear = leaderboardView(board, "clear", "fast")
  assert.deepEqual(clear.top.map((r) => r.accountId), ["fast", "slow"])
  assert.equal(clear.me?.rank, 1)
  const core = leaderboardView(board, "core")
  assert.deepEqual(core.top.map((r) => r.accountId), ["rich", "slow", "fast"])
  assert.equal(core.top[2].totalCore, 1e12)
  const pub = publicLeaderboardRow(clear.top[0], "fast")
  assert.equal(pub.isMe, true)
  assert.equal("accountId" in pub, false)
})

test("leaderboard: over the cap, clears survive and the least CORE falls off", () => {
  let board: Leaderboard = { entries: [] }
  for (let i = 0; i < LEADERBOARD_MAX_ENTRIES; i++) {
    board = upsertLeaderboard(board, leaderboardEntryFromSave(save({ totalCoreEnergy: 1000 + i, startedAt: 0 }), { id: `p${i}`, nickname: "n" }, 1)!)
  }
  board = upsertLeaderboard(
    board,
    leaderboardEntryFromSave(save({ totalCoreEnergy: 1, startedAt: 0, gameCompleted: true, completedAt: 100 }), { id: "clear", nickname: "n" }, 200)!,
  )
  assert.equal(board.entries.length, LEADERBOARD_MAX_ENTRIES)
  assert.ok(board.entries.some((e) => e.accountId === "clear"))
  assert.ok(!board.entries.some((e) => e.accountId === "p0"))
})
