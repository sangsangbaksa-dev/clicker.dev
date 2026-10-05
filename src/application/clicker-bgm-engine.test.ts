import assert from "node:assert/strict"
import { afterEach, beforeEach, mock, test } from "node:test"
import { createClickerBgmEngine } from "./clicker-bgm-engine.ts"
import type { BgmLoopTrack, ClickerBgmPorts } from "./clicker-audio-ports.ts"
import { BGM_TRACK_IDS, MINE_ENTER_CROSSFADE_MS, MINE_ENTER_FADE_IN_MS } from "../domain/services/clicker-bgm-tracks.ts"
import type { BgmTrackId } from "../domain/services/clicker-bgm.ts"

/*
 * The engine against fake ports: a manual rAF clock + mocked timers, no browser. It checks what
 * is played / paused / rewound and at which output level, not how anything sounds.
 */

type Fake = {
  id: BgmTrackId
  playing: boolean
  level: number
  plays: number
  rewinds: number
  preloads: number
  track: BgmLoopTrack
}

const settle = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

let now = 0
let frames: Array<(t: number) => void> = []
const fakes = new Map<BgmTrackId, Fake>()
const events: string[] = []

function makePorts(): ClickerBgmPorts {
  return {
    allTrackIds: () => [...BGM_TRACK_IDS],
    resumeSharedContext() {},
    acquireTrack(id) {
      let f = fakes.get(id)
      if (!f) {
        const fake: Fake = { id, playing: false, level: 0, plays: 0, rewinds: 0, preloads: 0, track: null as never }
        fake.track = {
          play() {
            if (!fake.playing) {
              fake.playing = true
              fake.plays++
              events.push(`play:${id}@${Math.round(now)}`)
            }
            return Promise.resolve()
          },
          pause() {
            if (fake.playing) events.push(`pause:${id}@${Math.round(now)}`)
            fake.playing = false
          },
          setOutputLevel(level) {
            fake.level = level
          },
          rewind() {
            fake.rewinds++
          },
          preload() {
            fake.preloads++
          },
        }
        fakes.set(id, fake)
        f = fake
      }
      return f.track
    },
    warmTracks() {},
    wireTrack() {},
    hasGainNode: () => true,
    dispose() {},
  }
}

/** Advance the rAF clock by `ms` in 16 ms frames (timers are mocked separately, ticked in step). */
async function run(ms: number) {
  const end = now + ms
  while (now < end) {
    const step = Math.min(16, end - now)
    now += step
    mock.timers.tick(step)
    const pending = frames
    frames = []
    for (const cb of pending) cb(now)
    await settle() // play().finally() callbacks (the hand-over timer is armed there) run between frames, as in a browser
  }
}

const level = (id: BgmTrackId) => fakes.get(id)?.level ?? 0

beforeEach(() => {
  now = 0
  frames = []
  fakes.clear()
  events.length = 0
  mock.timers.enable({ apis: ["setTimeout"] })
  const g = globalThis as Record<string, unknown>
  g.window = {
    requestAnimationFrame: (cb: (t: number) => void) => frames.push(cb),
    cancelAnimationFrame: () => {
      frames = []
    },
  }
})

afterEach(() => {
  mock.timers.reset()
  delete (globalThis as Record<string, unknown>).window
})

const OPEN = { muted: false, volume: 1, visual: undefined, hasUserGesture: true } as const

test("mine entrance: the entrance plays alone, then the mine loop crosses in over the 5 s hand-over and ends full when the entrance ends", async () => {
  const engine = createClickerBgmEngine(makePorts())
  engine.setState({ ...OPEN, scene: "hub" })
  await run(2000)
  assert.equal(fakes.get("hub")?.playing, true)

  engine.setState({ ...OPEN, scene: "mineEnter" })
  await settle()
  await run(MINE_ENTER_FADE_IN_MS + 50)
  // entrance is up and playing, the hub is gone, the loop is fetched (preload) but silent and not playing
  assert.equal(fakes.get("mineEnter")?.playing, true)
  assert.equal(level("mineEnter"), 0.5)
  assert.equal(fakes.get("hub")?.playing, false)
  assert.equal(fakes.get("mine")?.playing ?? false, false)
  assert.equal(fakes.get("mine")?.preloads, 1)

  // 5 s after the entrance started (10 s track - 5 s crossfade) the loop starts from 0
  await run(5000 - MINE_ENTER_FADE_IN_MS - 50 - 100)
  assert.equal(fakes.get("mine")?.playing ?? false, false, "not before the hand-over time")
  await run(300)
  await settle()
  await run(16)
  assert.equal(fakes.get("mine")?.playing, true)
  assert.equal(fakes.get("mine")?.rewinds, 1, "loop restarted from its beginning")
  assert.ok(level("mine") > 0 && level("mine") < 0.05, "just started to fade in")

  // halfway through the hand-over both are at about half level, then the loop is full and the entrance silent
  await run(MINE_ENTER_CROSSFADE_MS / 2)
  assert.ok(Math.abs(level("mine") - 0.25) < 0.03, `mine ${level("mine")}`)
  assert.ok(Math.abs(level("mineEnter") - 0.25) < 0.03, `enter ${level("mineEnter")}`)
  await run(MINE_ENTER_CROSSFADE_MS / 2 + 100)
  assert.equal(level("mine"), 0.5)
  assert.equal(level("mineEnter"), 0)
  assert.equal(fakes.get("mineEnter")?.playing, false, "entrance paused once faded out")

  // the cinematic ends -> plain mine scene: the loop keeps playing, no restart
  const rewindsBefore = fakes.get("mine")!.rewinds
  engine.setState({ ...OPEN, scene: "mine" })
  await run(1200)
  assert.equal(fakes.get("mine")?.playing, true)
  assert.equal(fakes.get("mine")?.rewinds, rewindsBefore)
  assert.equal(level("mine"), 0.5)
  engine.dispose()
})

test("skipping the cinematic early cuts the hand-over short: the mine loop fades in at the normal speed, the entrance is not rewound", async () => {
  const engine = createClickerBgmEngine(makePorts())
  engine.setState({ ...OPEN, scene: "mineEnter" })
  await settle()
  await run(1500)
  assert.equal(fakes.get("mineEnter")?.playing, true)
  engine.setState({ ...OPEN, scene: "mine" })
  await settle()
  await run(1000)
  assert.equal(level("mine"), 0.5)
  assert.equal(level("mineEnter"), 0)
  assert.equal(fakes.get("mineEnter")?.rewinds, 0)
  // the pending hand-over timer was cancelled: no late restart of the loop
  const rewinds = fakes.get("mine")!.rewinds
  await run(6000)
  assert.equal(fakes.get("mine")!.rewinds, rewinds)
  engine.dispose()
})

test("the ending's silent scene wins over a running mine entrance: everything fades out and nothing restarts", async () => {
  const engine = createClickerBgmEngine(makePorts())
  engine.setState({ ...OPEN, scene: "mineEnter" })
  await settle()
  await run(6500) // hand-over under way
  engine.setState({ ...OPEN, scene: "silent" })
  await run(1200)
  for (const id of BGM_TRACK_IDS) assert.equal(level(id), 0, id)
  for (const f of fakes.values()) assert.equal(f.playing, false, f.id)
  await run(8000)
  for (const f of fakes.values()) assert.equal(f.playing, false, f.id)
  engine.dispose()
})

test("a second entrance restarts the entrance track from 0 and the loop is rewound at the hand-over", async () => {
  const engine = createClickerBgmEngine(makePorts())
  engine.setState({ ...OPEN, scene: "mineEnter" })
  await settle()
  await run(11000)
  engine.setState({ ...OPEN, scene: "mine" })
  await run(1000)
  engine.setState({ ...OPEN, scene: "hub" })
  await run(1000)
  const enterRewinds = fakes.get("mineEnter")!.rewinds
  const loopRewinds = fakes.get("mine")!.rewinds
  engine.setState({ ...OPEN, scene: "mineEnter" })
  await settle()
  await run(400)
  assert.equal(fakes.get("mineEnter")!.rewinds, enterRewinds + 1)
  assert.equal(fakes.get("mineEnter")!.playing, true)
  assert.equal(fakes.get("mine")!.rewinds, loopRewinds, "loop untouched until the hand-over")
  await run(5200)
  await settle()
  await run(100)
  assert.equal(fakes.get("mine")!.rewinds, loopRewinds + 1)
  engine.dispose()
})

test("music muted: the entrance and the loop stay silent but the hand-over bookkeeping does not throw", async () => {
  const engine = createClickerBgmEngine(makePorts())
  engine.setState({ muted: true, volume: 1, visual: undefined, hasUserGesture: true, scene: "mineEnter" })
  await settle()
  await run(12000)
  assert.equal(fakes.size, 0, "no track is even created while muted")
  engine.dispose()
})

test("rebirth bed still hands over from the intro to the loop on the intro's ended event", async () => {
  let ended: (() => void) | undefined
  const ports = makePorts()
  const acquire = ports.acquireTrack
  ports.acquireTrack = (id, allow) => {
    const t = acquire(id, allow)
    if (t && id === "rebirthIntro") t.onEnded = (l) => (ended = l)
    return t
  }
  const engine = createClickerBgmEngine(ports)
  engine.setState({ ...OPEN, scene: "rebirth" })
  await settle()
  await run(1500)
  assert.equal(fakes.get("rebirthIntro")?.playing, true)
  assert.equal(level("rebirthIntro"), 0.5)
  assert.equal(fakes.get("rebirthHq")?.playing ?? false, false)
  await run(20000)
  assert.equal(fakes.get("rebirthHq")?.playing ?? false, false, "no timer hand-over for the rebirth bed")
  assert.ok(ended, "intro end hook registered")
  ended!()
  await run(1200)
  await settle()
  await run(100)
  assert.equal(fakes.get("rebirthHq")?.playing, true)
  assert.equal(level("rebirthHq"), 0.5)
  assert.equal(level("rebirthIntro"), 0)
  engine.dispose()
})

test("plain scene switch uses the default 900 ms fade", async () => {
  const engine = createClickerBgmEngine(makePorts())
  engine.setState({ ...OPEN, scene: "hub" })
  await settle()
  await run(1500)
  engine.setState({ ...OPEN, scene: "boss" })
  await settle()
  await run(450)
  assert.ok(Math.abs(level("hub") - 0.25) < 0.03, `hub ${level("hub")}`)
  await run(600)
  assert.equal(level("hub"), 0)
  assert.equal(level("boss"), 0.5)
  engine.dispose()
})
