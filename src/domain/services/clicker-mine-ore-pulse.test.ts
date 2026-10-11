import assert from "node:assert/strict"
import test from "node:test"
import { nextOrePulse, orePulseDamage, ORE_PULSE_MAX } from "./clicker-mine-ore-pulse.ts"

test("orePulseDamage weights crits", () => {
  assert.equal(orePulseDamage(false), 1)
  assert.equal(orePulseDamage(true), 2)
})

test("nextOrePulse counts down and shatters at zero", () => {
  let pulse = ORE_PULSE_MAX
  pulse = nextOrePulse(pulse, false).remaining
  assert.equal(pulse, ORE_PULSE_MAX - 1)
  pulse = nextOrePulse(pulse, true).remaining
  assert.equal(pulse, ORE_PULSE_MAX - 3)
  const fin = nextOrePulse(1, false)
  assert.equal(fin.remaining, 0)
  assert.equal(fin.shattered, true)
})
