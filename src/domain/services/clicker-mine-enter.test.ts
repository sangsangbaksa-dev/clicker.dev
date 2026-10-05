import assert from "node:assert/strict"
import { readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { MAX_HANDOFF_MS, pickCinematicQuality, resolveCinematicMedia } from "./clicker-cinematic.ts"
import { CINEMATIC_VARIANTS } from "../../data/clicker/cinematic-variants.ts"
import { MINE_ENTER_HANDOFF_MS, MINE_ENTER_POSTER, MINE_ENTER_VIDEOS, MineArt, mineEnterVideo } from "../../data/clicker/mine-assets.ts"

const PUBLIC = join(import.meta.dirname, "../../../public")
const onDisk = (src: string) => join(PUBLIC, src)

type Mp4Info = { seconds: number; width: number; height: number; handlers: string[] }

/** Minimal ISO-BMFF reader: movie duration, video size and the track handler types (vide / soun). */
function readMp4(file: string): Mp4Info {
  const buf = readFileSync(file)
  const info: Mp4Info = { seconds: 0, width: 0, height: 0, handlers: [] }
  const walk = (start: number, end: number) => {
    let p = start
    while (p + 8 <= end) {
      let size = buf.readUInt32BE(p)
      const type = buf.toString("latin1", p + 4, p + 8)
      let head = 8
      if (size === 1) {
        size = Number(buf.readBigUInt64BE(p + 8))
        head = 16
      } else if (size === 0) size = end - p
      const body = p + head
      if (type === "moov" || type === "trak" || type === "mdia") walk(body, p + size)
      else if (type === "mvhd") {
        const v = buf[body]
        const scale = buf.readUInt32BE(body + (v === 1 ? 20 : 12))
        const dur = v === 1 ? Number(buf.readBigUInt64BE(body + 24)) : buf.readUInt32BE(body + 16)
        info.seconds = dur / scale
      } else if (type === "tkhd") {
        const v = buf[body]
        const o = body + (v === 1 ? 88 : 76)
        const w = buf.readUInt32BE(o) / 65536
        const h = buf.readUInt32BE(o + 4) / 65536
        if (w > 0 && h > 0) {
          info.width = w
          info.height = h
        }
      } else if (type === "hdlr") info.handlers.push(buf.toString("latin1", body + 8, body + 12))
      if (size < 8) break
      p += size
    }
  }
  walk(0, buf.length)
  return info
}

test("registry: both qualities exist, are 10 s, 16:9, and the 720p twin is the lighter one", () => {
  assert.deepEqual(Object.keys(MINE_ENTER_VIDEOS).sort(), ["hq", "mobile720"])
  for (const v of Object.values(MINE_ENTER_VIDEOS)) {
    assert.equal(v.seconds, 10)
    assert.equal(v.width * 9, v.height * 16)
    assert.match(v.src, /^\/clicker\/mine\/.+\.mp4$/)
  }
  assert.notEqual(MINE_ENTER_VIDEOS.hq.src, MINE_ENTER_VIDEOS.mobile720.src)
  assert.equal(MINE_ENTER_VIDEOS.mobile720.height, 720)
  assert.equal(MINE_ENTER_VIDEOS.hq.height, 1080)
})

test("viewport -> quality -> source: phones get the 720p file, desktops the 1080p file; MineArt agrees", () => {
  assert.equal(mineEnterVideo(pickCinematicQuality({ viewportWidth: 390 })).src, MINE_ENTER_VIDEOS.mobile720.src)
  assert.equal(mineEnterVideo(pickCinematicQuality({ viewportWidth: 1366 })).src, MINE_ENTER_VIDEOS.hq.src)
  assert.equal(MineArt.enterCinematic, MINE_ENTER_VIDEOS.hq.src)
  assert.equal(MineArt.enterCinematicMobile, MINE_ENTER_VIDEOS.mobile720.src)
  assert.equal(MineArt.enterPoster, MINE_ENTER_POSTER)
})

test("the app passes MineArt.enterCinematic + the hub still; the registry resolves it per device (file, poster, fade)", () => {
  const phone = resolveCinematicMedia(MineArt.enterCinematic, MineArt.entranceGate, CINEMATIC_VARIANTS, pickCinematicQuality({ viewportWidth: 390 }))
  assert.deepEqual(phone, { src: MINE_ENTER_VIDEOS.mobile720.src, poster: MINE_ENTER_POSTER, handoffMs: MINE_ENTER_HANDOFF_MS })
  const desktop = resolveCinematicMedia(MineArt.enterCinematic, MineArt.entranceGate, CINEMATIC_VARIANTS, pickCinematicQuality({ viewportWidth: 1920 }))
  assert.deepEqual(desktop, { src: MINE_ENTER_VIDEOS.hq.src, poster: MINE_ENTER_POSTER, handoffMs: MINE_ENTER_HANDOFF_MS })
})

test("other cinematics (region intros, ending) pass through unchanged: no twin, own poster, no fade", () => {
  for (const viewportWidth of [390, 1920]) {
    const r = resolveCinematicMedia("/clicker/intro/other.mp4", "/clicker/intro/other.webp", CINEMATIC_VARIANTS, pickCinematicQuality({ viewportWidth }))
    assert.deepEqual(r, { src: "/clicker/intro/other.mp4", poster: "/clicker/intro/other.webp", handoffMs: 0 })
  }
})

test("handoff fade is a short, sane cross-fade", () => {
  assert.ok(MINE_ENTER_HANDOFF_MS >= 200 && MINE_ENTER_HANDOFF_MS <= MAX_HANDOFF_MS)
})

test("shipped files exist (run apply-assets.sh first) and match the registry: size, length, audio track", () => {
  for (const [quality, v] of Object.entries(MINE_ENTER_VIDEOS)) {
    const file = onDisk(v.src)
    const bytes = statSync(file).size
    const mp4 = readMp4(file)
    assert.equal(mp4.width, v.width, `${quality} width`)
    assert.equal(mp4.height, v.height, `${quality} height`)
    assert.ok(Math.abs(mp4.seconds - v.seconds) < 0.05, `${quality} length ${mp4.seconds}`)
    assert.ok(mp4.handlers.includes("vide"), `${quality} has video`)
    assert.ok(mp4.handlers.includes("soun"), `${quality} keeps the soundtrack`)
    if (quality === "mobile720") assert.ok(bytes < 3_000_000, `720p must stay light, got ${bytes}`)
  }
  assert.ok(statSync(onDisk(MINE_ENTER_POSTER)).size > 20_000)
})

test("the poster is the polish render's first frame (a webp), not the old hub still", () => {
  assert.match(MINE_ENTER_POSTER, /\.webp$/)
  assert.notEqual(MINE_ENTER_POSTER, MineArt.entranceGate)
  assert.equal(readFileSync(onDisk(MINE_ENTER_POSTER)).toString("latin1", 8, 12), "WEBP")
})

test("the previous v17 render stays registered for rollback and is no longer the live source", () => {
  assert.equal(MineArt.enterCinematicV17, "/clicker/mine/mine_enter_door_walk_v17.mp4")
  assert.notEqual(MineArt.enterCinematic, MineArt.enterCinematicV17)
})
