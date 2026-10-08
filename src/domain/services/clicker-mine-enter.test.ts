import assert from "node:assert/strict"
import { readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { MAX_HANDOFF_MS, pickCinematicQuality, resolveCinematicMedia } from "./clicker-cinematic.ts"
import { CINEMATIC_VARIANTS } from "../../data/clicker/cinematic-variants.ts"
import { MINE_ENTER_HANDOFF_MS, MINE_ENTER_POSTER, MINE_ENTER_VIDEO, MineArt, mineEnterVideo } from "../../data/clicker/mine-assets.ts"

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

test("registry: single 1080p polish render, 10 s, 16:9", () => {
  const v = MINE_ENTER_VIDEO
  assert.equal(v.seconds, 10)
  assert.equal(v.width * 9, v.height * 16)
  assert.match(v.src, /^\/clicker\/mine\/.+\.mp4$/)
  assert.equal(v.height, 1080)
})

test("mine entry uses one video on every device; MineArt matches the registry", () => {
  assert.equal(mineEnterVideo().src, MINE_ENTER_VIDEO.src)
  assert.equal(mineEnterVideo().src, mineEnterVideo().src)
  assert.equal(MineArt.enterCinematic, MINE_ENTER_VIDEO.src)
  assert.equal(MineArt.enterPoster, MINE_ENTER_POSTER)
})

test("the app passes MineArt.enterCinematic + enterPoster; resolution ignores viewport quality", () => {
  for (const viewportWidth of [390, 1920]) {
    const r = resolveCinematicMedia(
      MineArt.enterCinematic,
      MineArt.enterPoster,
      CINEMATIC_VARIANTS,
      pickCinematicQuality({ viewportWidth }),
    )
    assert.deepEqual(r, { src: MINE_ENTER_VIDEO.src, poster: MINE_ENTER_POSTER, handoffMs: MINE_ENTER_HANDOFF_MS })
  }
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
  const v = MINE_ENTER_VIDEO
  const file = onDisk(v.src)
  const bytes = statSync(file).size
  const mp4 = readMp4(file)
  assert.equal(mp4.width, v.width, "width")
  assert.equal(mp4.height, v.height, "height")
  assert.ok(Math.abs(mp4.seconds - v.seconds) < 0.05, `length ${mp4.seconds}`)
  assert.ok(mp4.handlers.includes("vide"), "has video")
  assert.ok(mp4.handlers.includes("soun"), "keeps the soundtrack")
  assert.ok(bytes > 500_000, `1080p file present, got ${bytes}`)
  assert.ok(statSync(onDisk(MINE_ENTER_POSTER)).size > 20_000)
})

test("hub, title, and cinematic poster share the polish first frame (webp)", () => {
  assert.match(MINE_ENTER_POSTER, /\.webp$/)
  assert.equal(MineArt.enterPoster, MINE_ENTER_POSTER)
  assert.equal(readFileSync(onDisk(MINE_ENTER_POSTER)).toString("latin1", 8, 12), "WEBP")
})
