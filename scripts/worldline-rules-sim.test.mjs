// Slow guard (~3 min): the full playthrough with worldline rules stays within ±0.5 % of 472m50s.
// Run: node --test scripts/worldline-rules-sim.test.mjs   (not in `npm test`: too slow for every run)
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import test from "node:test"

const TARGET_SEC = 472 * 60 + 50

test("playtime-sim total within ±0.5 % of 472m50s", { timeout: 900_000 }, () => {
  const out = execFileSync(process.execPath, ["--experimental-strip-types", "scripts/playtime-sim.ts"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
  const m = out.match(/^total (\d+)m(\d+)s/m)
  assert.ok(m, "sim printed a total")
  const sec = Number(m[1]) * 60 + Number(m[2])
  assert.ok(Math.abs(sec - TARGET_SEC) / TARGET_SEC <= 0.005, `total ${m[1]}m${m[2]}s`)
})
