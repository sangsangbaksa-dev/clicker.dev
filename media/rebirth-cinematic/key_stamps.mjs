// The stamp art is a JPEG with a baked grey checkerboard: key it out by saturation (the marks are vivid).
// node media/rebirth-cinematic/key_stamps.mjs → media/rebirth-cinematic/keyed/*.png
import sharp from "sharp"
import fs from "node:fs"
const dir = new URL("./keyed/", import.meta.url).pathname
fs.mkdirSync(dir, { recursive: true })
for (const name of ["directive_pulse", "aurelia_grid", "resonance_protocol", "volatile_core", "adaptive_architect"]) {
  const { data, info } = await sharp(`public/clicker/stamp/stamp_${name}.png`).raw().toBuffer({ resolveWithObject: true })
  const out = Buffer.alloc(info.width * info.height * 4)
  for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2]
    const sat = Math.max(r, g, b) - Math.min(r, g, b)
    const a = Math.min(1, Math.max(0, (sat - 28) / 50))
    out[j] = r; out[j + 1] = g; out[j + 2] = b; out[j + 3] = Math.round(a * 255)
  }
  await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toFile(`${dir}stamp_${name}.png`)
}
